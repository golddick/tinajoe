import { and, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { confirmPaystackPayment } from '@/lib/payment-confirmation'
import { db } from '@/lib/db'
import { cakeRequests } from '@/lib/db/schema'
import { isValidPaystackSignature } from '@/lib/paystack'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  let validSignature: boolean

  try {
    validSignature = isValidPaystackSignature(
      rawBody,
      request.headers.get('x-paystack-signature'),
    )
  } catch (error) {
    console.error('Paystack webhook verification is not configured:', error)
    return NextResponse.json(
      { error: 'Payment webhook is not configured.' },
      { status: 503 },
    )
  }

  if (!validSignature) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  let event: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(rawBody)
    if (!isRecord(parsed)) throw new Error('Invalid event body.')
    event = parsed
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  const data = isRecord(event.data) ? event.data : {}

  try {
    if (event.event === 'charge.success') {
      if (typeof data.reference !== 'string') {
        return NextResponse.json(
          { error: 'Payment event is missing its reference.' },
          { status: 400 },
        )
      }
      await confirmPaystackPayment(data.reference)
    } else if (
      typeof event.event === 'string' &&
      event.event.startsWith('refund.')
    ) {
      const transaction = isRecord(data.transaction) ? data.transaction : {}
      const transactionReference =
        typeof transaction.reference === 'string'
          ? transaction.reference
          : typeof data.transaction === 'string'
            ? data.transaction
            : null
      const refundReference =
        typeof data.id === 'string' || typeof data.id === 'number'
          ? String(data.id)
          : null
      const refundStatus =
        event.event === 'refund.processed'
          ? 'refunded'
          : event.event === 'refund.failed'
            ? 'refund_failed'
            : 'refund_pending'
      const currentRefundStatuses =
        refundStatus === 'refunded'
          ? ['refund_pending', 'refund_failed', 'refunded']
          : ['refund_pending', 'refund_failed']
      const referenceFilter = [
        transactionReference
          ? eq(cakeRequests.paymentReference, transactionReference)
          : undefined,
        refundReference
          ? eq(cakeRequests.refundReference, refundReference)
          : undefined,
      ].filter((filter) => filter !== undefined)

      if (referenceFilter.length) {
        await db
          .update(cakeRequests)
          .set({
            status: 'rejected',
            paymentStatus: refundStatus,
            ...(refundReference ? { refundReference } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(cakeRequests.status, ['rejected', 'refund_pending']),
              inArray(cakeRequests.paymentStatus, currentRefundStatuses),
              or(...referenceFilter),
            ),
          )
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Paystack webhook event could not be processed:', error)
    return NextResponse.json(
      { error: 'Payment event could not be processed.' },
      { status: 500 },
    )
  }
}
