import { createHmac, timingSafeEqual } from 'node:crypto'

const PAYSTACK_API_URL = 'https://api.paystack.co'

type PaystackEnvelope<T> = {
  status?: boolean
  message?: string
  data?: T
}

export type PaystackTransaction = {
  reference: string
  status: string
  amount: number
  currency: string
  metadata?: {
    request_id?: string
  }
}

export type PaystackRefund = {
  id: string | number
  status: string
}

export function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.')
  }
  return secretKey
}

export function assertPaystackConfiguration() {
  getPaystackSecretKey()

  const siteUrl = process.env.BETTER_AUTH_URL?.trim()
  if (!siteUrl) {
    throw new Error('BETTER_AUTH_URL is not configured.')
  }

  const parsedSiteUrl = new URL(siteUrl)
  if (!['http:', 'https:'].includes(parsedSiteUrl.protocol)) {
    throw new Error('BETTER_AUTH_URL must use HTTP or HTTPS.')
  }
}

async function paystackRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPaystackSecretKey()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  let result: PaystackEnvelope<T>
  try {
    result = (await response.json()) as PaystackEnvelope<T>
  } catch {
    throw new Error(`Paystack returned an invalid response (${response.status}).`)
  }

  if (!response.ok || result.status !== true || result.data === undefined) {
    throw new Error(
      result.message || `Paystack request failed (${response.status}).`,
    )
  }

  return result.data
}

export async function initializePaystackTransaction(input: {
  reference: string
  email: string
  amount: number
  currency: string
  requestId: string
}) {
  const amountInMinorUnits = Math.round(input.amount * 100)
  if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits < 1) {
    throw new Error('The order total is invalid for online payment.')
  }

  const configuredSiteUrl = process.env.BETTER_AUTH_URL?.trim()
  if (!configuredSiteUrl) {
    throw new Error('BETTER_AUTH_URL is not configured.')
  }
  const siteUrl = new URL(configuredSiteUrl)
  const transaction = await paystackRequest<{
    authorization_url: string
    reference: string
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      reference: input.reference,
      email: input.email,
      amount: amountInMinorUnits,
      currency: input.currency,
      callback_url: new URL('/api/payments/paystack/callback', siteUrl).toString(),
      metadata: { request_id: input.requestId },
    }),
  })

  if (
    typeof transaction.authorization_url !== 'string' ||
    typeof transaction.reference !== 'string' ||
    transaction.reference !== input.reference
  ) {
    throw new Error('Paystack did not return checkout details.')
  }
  const authorizationUrl = new URL(transaction.authorization_url)
  if (
    authorizationUrl.protocol !== 'https:' ||
    !authorizationUrl.hostname.endsWith('.paystack.com')
  ) {
    throw new Error('Paystack returned an invalid checkout URL.')
  }

  return transaction
}

export function verifyPaystackTransaction(reference: string) {
  return paystackRequest<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  )
}

export function createPaystackRefund(input: {
  reference: string
  reason: string
}) {
  return paystackRequest<PaystackRefund>('/refund', {
    method: 'POST',
    body: JSON.stringify({
      transaction: input.reference,
      reason: input.reason,
    }),
  })
}

export function isValidPaystackSignature(
  payload: string,
  signature: string | null,
) {
  if (!signature || !/^[a-f\d]{128}$/i.test(signature)) return false

  const expected = createHmac('sha512', getPaystackSecretKey())
    .update(payload)
    .digest()
  const received = Buffer.from(signature, 'hex')

  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  )
}
