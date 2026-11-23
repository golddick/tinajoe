import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cakeRequests,
  customers,
  studioAdmin,
  user,
} from '@/lib/db/schema'
import { sendCustomerEmail } from '@/lib/customer-email'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { verifyPaystackTransaction } from '@/lib/paystack'

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export async function confirmPaystackPayment(reference: string) {
  const [row] = await db
    .select({ request: cakeRequests, customer: customers })
    .from(cakeRequests)
    .innerJoin(customers, eq(cakeRequests.customerId, customers.id))
    .where(eq(cakeRequests.paymentReference, reference))
    .limit(1)

  if (!row) {
    throw new Error('No cake request is linked to this payment reference.')
  }

  const { request: cakeRequest, customer } = row
  if (
    cakeRequest.paymentStatus !== 'paid' &&
    cakeRequest.paymentStatus !== 'awaiting_payment'
  ) {
    throw new Error('This cake request is not awaiting payment.')
  }

  const total =
    Number(cakeRequest.cakeEstimate) +
    Number(cakeRequest.deliveryFee ?? 0)

  if (cakeRequest.paymentStatus === 'awaiting_payment') {
    const transaction = await verifyPaystackTransaction(reference)
    const expectedAmount = Math.round(total * 100)

    if (
      transaction.reference !== reference ||
      transaction.status !== 'success' ||
      transaction.amount !== expectedAmount ||
      transaction.currency !== cakeRequest.currency
    ) {
      throw new Error('Paystack payment details do not match this cake request.')
    }

    const [updated] = await db
      .update(cakeRequests)
      .set({
        status: 'new_request',
        paymentStatus: 'paid',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cakeRequests.id, cakeRequest.id),
          eq(cakeRequests.paymentStatus, 'awaiting_payment'),
        ),
      )
      .returning({ id: cakeRequests.id })

    if (!updated) {
      const [current] = await db
        .select({
          id: cakeRequests.id,
          paymentStatus: cakeRequests.paymentStatus,
        })
        .from(cakeRequests)
        .where(eq(cakeRequests.id, cakeRequest.id))
        .limit(1)

      if (current?.paymentStatus !== 'paid') {
        throw new Error(
          'The payment was verified but the cake request could not be updated.',
        )
      }
    }
  }

  const settings = await getDeliverySettings()
  const fulfillmentDetails =
    cakeRequest.fulfillment === 'Delivery'
      ? `Delivery to ${cakeRequest.deliveryAddress}, ${cakeRequest.deliveryPostcode}.`
      : `Studio collection at ${settings.bakeryAddress || 'the studio'}.`

  if (!cakeRequest.paymentEmailSentAt) {
    await sendCustomerEmail({
      to: customer.email,
      subject: `Payment confirmed for cake order ${cakeRequest.id}`,
      metadata: {
        cakeOrderId: cakeRequest.id,
        notificationType: 'payment-confirmation',
      },
      content: {
        preheader: `Your payment for cake order ${cakeRequest.id} is confirmed.`,
        title: 'Your payment is confirmed',
        greeting: `Hello ${customer.name},`,
        paragraphs: [
          `We’ve received your payment of ${formatAmount(total, cakeRequest.currency)}. Your order is now in the studio request queue for review.`,
          'We’ll email you again as soon as the studio has reviewed your cake design.',
        ],
        details: [
          { label: 'Order', value: cakeRequest.id },
          { label: 'Preferred date', value: cakeRequest.preferredDate },
          { label: 'Fulfillment', value: cakeRequest.fulfillment },
          { label: 'Details', value: fulfillmentDetails },
          {
            label: 'Paid in full',
            value: formatAmount(total, cakeRequest.currency),
          },
        ],
      },
    })

    const [emailRecorded] = await db
      .update(cakeRequests)
      .set({ paymentEmailSentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(cakeRequests.id, cakeRequest.id),
          isNull(cakeRequests.paymentEmailSentAt),
        ),
      )
      .returning({ id: cakeRequests.id })

    if (!emailRecorded) {
      const [current] = await db
        .select({ paymentEmailSentAt: cakeRequests.paymentEmailSentAt })
        .from(cakeRequests)
        .where(eq(cakeRequests.id, cakeRequest.id))
        .limit(1)

      if (!current?.paymentEmailSentAt) {
        throw new Error(
          'The payment receipt was sent but its delivery status could not be saved.',
        )
      }
    }
  }

  if (!cakeRequest.adminNotificationSentAt) {
    const [admin] = await db
      .select({ email: user.email })
      .from(studioAdmin)
      .innerJoin(user, eq(studioAdmin.userId, user.id))
      .limit(1)

    if (!admin?.email) {
      throw new Error('The studio admin email is not configured.')
    }

    const siteUrl = process.env.BETTER_AUTH_URL?.trim()
    if (!siteUrl) {
      throw new Error('BETTER_AUTH_URL is not configured.')
    }

    await sendCustomerEmail({
      to: admin.email,
      subject: `Paid cake order needs review: ${cakeRequest.id}`,
      metadata: {
        cakeOrderId: cakeRequest.id,
        notificationType: 'paid-order-admin-notification',
      },
      content: {
        preheader: `A paid cake order from ${customer.name} is ready for review.`,
        title: 'A paid order is ready for review',
        greeting: 'Hello,',
        paragraphs: [
          `${customer.name} has paid in full for a cake order. Review the customization and fulfillment details in the studio dashboard.`,
        ],
        details: [
          { label: 'Order', value: cakeRequest.id },
          { label: 'Customer', value: customer.name },
          { label: 'Email', value: customer.email },
          { label: 'Phone', value: customer.phone },
          { label: 'Preferred date', value: cakeRequest.preferredDate },
          { label: 'Fulfillment', value: cakeRequest.fulfillment },
          { label: 'Details', value: fulfillmentDetails },
          {
            label: 'Paid in full',
            value: formatAmount(total, cakeRequest.currency),
          },
        ],
        button: {
          label: 'Review cake request',
          url: new URL('/admin', siteUrl).toString(),
        },
      },
    })

    const [notificationRecorded] = await db
      .update(cakeRequests)
      .set({ adminNotificationSentAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(cakeRequests.id, cakeRequest.id),
          isNull(cakeRequests.adminNotificationSentAt),
        ),
      )
      .returning({ id: cakeRequests.id })

    if (!notificationRecorded) {
      const [current] = await db
        .select({
          adminNotificationSentAt: cakeRequests.adminNotificationSentAt,
        })
        .from(cakeRequests)
        .where(eq(cakeRequests.id, cakeRequest.id))
        .limit(1)

      if (!current?.adminNotificationSentAt) {
        throw new Error(
          'The admin notification was sent but its delivery status could not be saved.',
        )
      }
    }
  }

  return cakeRequest.id
}
