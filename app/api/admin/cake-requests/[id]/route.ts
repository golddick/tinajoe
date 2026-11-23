import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { assertCustomerEmailConfiguration, sendCustomerEmail } from '@/lib/customer-email'
import { getAdminSession } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { cakeRequests, customers } from '@/lib/db/schema'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { createPaystackRefund } from '@/lib/paystack'

type RequestAction =
  | { action: 'approve'; note: string }
  | { action: 'reject'; note: string }
  | { action: 'retry_refund' }
  | { action: 'resend_refund_email' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function orderTotal(cakeEstimate: string, deliveryFee: string | null) {
  return Number(cakeEstimate) + Number(deliveryFee ?? 0)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await context.params
  if (!id || id.length > 200) {
    return NextResponse.json({ error: 'Choose a valid cake request.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!isRecord(payload) || typeof payload.action !== 'string') {
    return NextResponse.json({ error: 'Choose an order action.' }, { status: 400 })
  }

  let action: RequestAction
  if (payload.action === 'approve' || payload.action === 'reject') {
    if (typeof payload.note !== 'string' || payload.note.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Enter a note of 2,000 characters or fewer.' },
        { status: 400 },
      )
    }
    action = { action: payload.action, note: payload.note.trim() }
  } else if (
    payload.action === 'retry_refund' ||
    payload.action === 'resend_refund_email'
  ) {
    action =
      payload.action === 'retry_refund'
        ? { action: 'retry_refund' }
        : { action: 'resend_refund_email' }
  } else {
    return NextResponse.json({ error: 'Choose a valid order action.' }, { status: 400 })
  }

  const [row] = await db
    .select({ request: cakeRequests, customer: customers })
    .from(cakeRequests)
    .innerJoin(customers, eq(cakeRequests.customerId, customers.id))
    .where(eq(cakeRequests.id, id))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Cake request not found.' }, { status: 404 })
  }

  const { request: cakeRequest, customer } = row
  const total = orderTotal(cakeRequest.cakeEstimate, cakeRequest.deliveryFee)
  const amount = formatAmount(total, cakeRequest.currency)

  if (action.action === 'approve') {
    if (cakeRequest.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: 'Only fully paid cake requests can be approved.' },
        { status: 409 },
      )
    }

    let approvalNote: string
    if (cakeRequest.status === 'new_request') {
      if (!action.note) {
        return NextResponse.json(
          { error: 'Add an approval note for the customer.' },
          { status: 400 },
        )
      }
      const [updated] = await db
        .update(cakeRequests)
        .set({
          status: 'approval_pending',
          approvalNote: action.note,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cakeRequests.id, id),
            eq(cakeRequests.status, 'new_request'),
            eq(cakeRequests.paymentStatus, 'paid'),
          ),
        )
        .returning({ id: cakeRequests.id })

      if (!updated) {
        return NextResponse.json(
          { error: 'This cake request has already changed. Refresh and try again.' },
          { status: 409 },
        )
      }
      approvalNote = action.note
    } else if (cakeRequest.status === 'approval_pending') {
      approvalNote = cakeRequest.approvalNote ?? ''
      if (!approvalNote) {
        return NextResponse.json(
          { error: 'Add an approval note before retrying the approval email.' },
          { status: 409 },
        )
      }
    } else {
      return NextResponse.json(
        { error: 'This cake request can no longer be approved.' },
        { status: 409 },
      )
    }

    try {
      assertCustomerEmailConfiguration()
      const settings = await getDeliverySettings()
      const fulfillmentDetails =
        cakeRequest.fulfillment === 'Delivery'
          ? `Delivery to ${cakeRequest.deliveryAddress}, ${cakeRequest.deliveryPostcode}.`
          : `Studio collection at ${settings.bakeryAddress || 'the studio'}.`

      await sendCustomerEmail({
        to: customer.email,
        subject: `Your cake order ${id} is approved`,
        metadata: {
          cakeOrderId: id,
          notificationType: 'order-approval',
        },
        content: {
          preheader: `Good news: your cake order ${id} has been approved.`,
          title: 'Your cake is approved',
          greeting: `Hello ${customer.name},`,
          paragraphs: [
            'The studio has reviewed your order and is delighted to confirm your cake.',
          ],
          details: [
            { label: 'Order', value: id },
            { label: 'Preferred date', value: cakeRequest.preferredDate },
            { label: 'Fulfillment', value: cakeRequest.fulfillment },
            { label: 'Details', value: fulfillmentDetails },
            { label: 'Paid in full', value: amount },
          ],
          highlight: {
            label: 'A note from the studio',
            value: approvalNote,
          },
        },
      })

      const [confirmed] = await db
        .update(cakeRequests)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(
          and(
            eq(cakeRequests.id, id),
            eq(cakeRequests.status, 'approval_pending'),
          ),
        )
        .returning({ id: cakeRequests.id })

      if (!confirmed) {
        throw new Error('Approval email was sent but the order status could not be updated.')
      }

      return NextResponse.json({
        ok: true,
        status: 'confirmed',
        paymentStatus: 'paid',
        approvalNote,
      })
    } catch (error) {
      console.error(`Cake order approval email failed for ${id}:`, error)
      return NextResponse.json(
        {
          error:
            'The order is awaiting approval email delivery. Retry the approval email from this request.',
          status: 'approval_pending',
          paymentStatus: 'paid',
        },
        { status: 502 },
      )
    }
  }

  if (action.action === 'resend_refund_email') {
    if (
      cakeRequest.status !== 'rejected' ||
      !cakeRequest.refundReference ||
      !['refund_pending', 'refunded', 'refund_failed'].includes(
        cakeRequest.paymentStatus,
      )
    ) {
      return NextResponse.json(
        { error: 'A refund email is not available for this order yet.' },
        { status: 409 },
      )
    }

    try {
      await sendRefundEmail({
        requestId: id,
        customerName: customer.name,
        customerEmail: customer.email,
        amount,
        note: cakeRequest.rejectionNote ?? '',
        paymentStatus: cakeRequest.paymentStatus,
      })
      return NextResponse.json({
        ok: true,
        status: cakeRequest.status,
        paymentStatus: cakeRequest.paymentStatus,
      })
    } catch (error) {
      console.error(`Cake order refund email retry failed for ${id}:`, error)
      return NextResponse.json(
        { error: 'The refund email could not be sent. Please try again.' },
        { status: 502 },
      )
    }
  }

  if (action.action === 'retry_refund') {
    if (
      cakeRequest.status !== 'refund_pending' ||
      cakeRequest.paymentStatus !== 'refund_pending' ||
      cakeRequest.refundReference ||
      !cakeRequest.paymentReference
    ) {
      return NextResponse.json(
        { error: 'This order is not eligible for a refund retry.' },
        { status: 409 },
      )
    }

    let refund: Awaited<ReturnType<typeof createPaystackRefund>>
    try {
      refund = await createPaystackRefund({
        reference: cakeRequest.paymentReference,
        reason: `Cake order ${id} declined by the studio.`,
      })
    } catch (error) {
      console.error(`Cake order refund retry result is unknown for ${id}:`, error)
      return NextResponse.json(
        {
          error:
            'The refund retry could not be confirmed. Check the Paystack dashboard before trying again.',
          status: 'refund_pending',
          paymentStatus: 'refund_pending',
        },
        { status: 502 },
      )
    }

    const refundStatus =
      refund.status === 'processed'
        ? 'refunded'
        : refund.status === 'failed'
          ? 'refund_failed'
          : 'refund_pending'
    try {
      await db
        .update(cakeRequests)
        .set({
          status: 'rejected',
          paymentStatus: refundStatus,
          refundReference: String(refund.id),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(cakeRequests.id, id),
            eq(cakeRequests.status, 'refund_pending'),
            eq(cakeRequests.paymentStatus, 'refund_pending'),
          ),
        )
    } catch (error) {
      console.error(`Cake order refund retry status could not be saved for ${id}:`, error)
      return NextResponse.json(
        {
          error:
            'Paystack accepted the refund retry, but the order status could not be saved. Check the Paystack dashboard.',
          status: 'refund_pending',
          paymentStatus: 'refund_pending',
        },
        { status: 502 },
      )
    }

    try {
      await sendRefundEmail({
        requestId: id,
        customerName: customer.name,
        customerEmail: customer.email,
        amount,
        note: cakeRequest.rejectionNote ?? '',
        paymentStatus: refundStatus,
      })
    } catch (error) {
      console.error(`Cake order refund retry email failed for ${id}:`, error)
      return NextResponse.json(
        {
          error: 'Refund submitted, but the customer email could not be sent. Retry the refund email.',
          status: 'rejected',
          paymentStatus: refundStatus,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      status: 'rejected',
      paymentStatus: refundStatus,
      rejectionNote: cakeRequest.rejectionNote ?? '',
    })
  }

  if (cakeRequest.paymentStatus !== 'paid' || cakeRequest.status !== 'new_request') {
    return NextResponse.json(
      { error: 'Only paid requests that have not been reviewed can be rejected.' },
      { status: 409 },
    )
  }
  if (!action.note) {
    return NextResponse.json(
      { error: 'Add a refund note for the customer.' },
      { status: 400 },
    )
  }
  if (!cakeRequest.paymentReference) {
    return NextResponse.json(
      { error: 'This paid order has no payment reference for a refund.' },
      { status: 409 },
    )
  }

  const [refundStarted] = await db
    .update(cakeRequests)
    .set({
      status: 'refund_pending',
      paymentStatus: 'refund_pending',
      rejectionNote: action.note,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cakeRequests.id, id),
        eq(cakeRequests.status, 'new_request'),
        eq(cakeRequests.paymentStatus, 'paid'),
      ),
    )
    .returning({ id: cakeRequests.id })

  if (!refundStarted) {
    return NextResponse.json(
      { error: 'This cake request has already changed. Refresh and try again.' },
      { status: 409 },
    )
  }

  let refund: Awaited<ReturnType<typeof createPaystackRefund>>
  try {
    refund = await createPaystackRefund({
      reference: cakeRequest.paymentReference,
      reason: `Cake order ${id} declined by the studio.`,
    })
  } catch (error) {
    console.error(`Cake order refund result is unknown for ${id}:`, error)
    return NextResponse.json(
      {
        error:
          'The refund result could not be confirmed. Check the Paystack dashboard before attempting another refund.',
        status: 'refund_pending',
        paymentStatus: 'refund_pending',
      },
      { status: 502 },
    )
  }

  const refundStatus =
    refund.status === 'processed'
      ? 'refunded'
      : refund.status === 'failed'
        ? 'refund_failed'
        : 'refund_pending'

  try {
    await db
      .update(cakeRequests)
      .set({
        status: 'rejected',
        paymentStatus: refundStatus,
        refundReference: String(refund.id),
        updatedAt: new Date(),
      })
      .where(eq(cakeRequests.id, id))
  } catch (error) {
    console.error(`Cake order refund status could not be saved for ${id}:`, error)
    return NextResponse.json(
      {
        error:
          'Paystack accepted the refund, but the order status could not be saved. Check the Paystack dashboard.',
        status: 'refund_pending',
        paymentStatus: 'refund_pending',
      },
      { status: 502 },
    )
  }

  try {
    await sendRefundEmail({
      requestId: id,
      customerName: customer.name,
      customerEmail: customer.email,
      amount,
      note: action.note,
      paymentStatus: refundStatus,
    })
  } catch (error) {
    console.error(`Cake order refund email failed for ${id}:`, error)
    return NextResponse.json(
      {
        error: 'Refund submitted, but the customer email could not be sent. Retry the refund email.',
        status: 'rejected',
        paymentStatus: refundStatus,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    status: 'rejected',
    paymentStatus: refundStatus,
    rejectionNote: action.note,
  })
}

async function sendRefundEmail(input: {
  requestId: string
  customerName: string
  customerEmail: string
  amount: string
  note: string
  paymentStatus: string
}) {
  assertCustomerEmailConfiguration()
  const refundStatus =
    input.paymentStatus === 'refunded'
      ? 'Paystack confirms that the refund has been processed.'
      : input.paymentStatus === 'refund_failed'
        ? 'Paystack could not complete the refund. The studio will follow up with you.'
        : 'A full refund has been requested through Paystack to the original payment method. Processing times vary by payment provider and bank.'

  await sendCustomerEmail({
    to: input.customerEmail,
    subject: `Update on cake order ${input.requestId}`,
    metadata: {
      cakeOrderId: input.requestId,
      notificationType: 'order-refund',
    },
    content: {
      preheader: `An update about your cake order ${input.requestId}.`,
      title: 'An update on your cake order',
      greeting: `Hello ${input.customerName},`,
      paragraphs: [
        `The studio has declined cake order ${input.requestId}.`,
        refundStatus,
        'The refund is returned to the original payment method. Your bank or payment provider controls when the funds appear. Contact the studio if you need help.',
      ],
      details: [
        { label: 'Order', value: input.requestId },
        { label: 'Refund amount', value: input.amount },
      ],
      highlight: {
        label: 'A note from the studio',
        value: input.note,
      },
    },
  })
}
