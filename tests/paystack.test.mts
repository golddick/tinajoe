import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  initializePaystackTransaction,
  isValidPaystackSignature,
  verifyPaystackTransaction,
} from '../lib/paystack.ts'

const originalFetch = globalThis.fetch
const originalSecretKey = process.env.PAYSTACK_SECRET_KEY
const originalSiteUrl = process.env.BETTER_AUTH_URL

function restoreEnvironment() {
  globalThis.fetch = originalFetch
  if (originalSecretKey === undefined) {
    delete process.env.PAYSTACK_SECRET_KEY
  } else {
    process.env.PAYSTACK_SECRET_KEY = originalSecretKey
  }
  if (originalSiteUrl === undefined) {
    delete process.env.BETTER_AUTH_URL
  } else {
    process.env.BETTER_AUTH_URL = originalSiteUrl
  }
}

describe('Paystack integration', () => {
  it('initializes checkout with the full amount and payment callback', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_example'
    process.env.BETTER_AUTH_URL = 'https://crumb.example'
    let captured:
      | {
          url: string
          headers: Headers
          body: Record<string, unknown>
        }
      | undefined

    globalThis.fetch = async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }
      return Response.json({
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/example',
          reference: 'payment-reference',
        },
      })
    }

    try {
      const checkout = await initializePaystackTransaction({
        reference: 'payment-reference',
        email: 'customer@example.com',
        amount: 180.5,
        currency: 'USD',
        requestId: 'cake-request-123',
      })

      assert.equal(checkout.authorization_url, 'https://checkout.paystack.com/example')
      assert.equal(captured?.url, 'https://api.paystack.co/transaction/initialize')
      assert.equal(
        captured?.headers.get('Authorization'),
        'Bearer sk_test_example',
      )
      assert.deepEqual(captured?.body, {
        reference: 'payment-reference',
        email: 'customer@example.com',
        amount: 18050,
        currency: 'USD',
        callback_url: 'https://crumb.example/api/payments/paystack/callback',
        metadata: { request_id: 'cake-request-123' },
      })
    } finally {
      restoreEnvironment()
    }
  })

  it('verifies payments using an escaped reference and server-side key', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_example'
    let capturedUrl = ''
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input)
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer sk_test_example')
      return Response.json({
        status: true,
        data: {
          reference: 'reference/with space',
          status: 'success',
          amount: 10000,
          currency: 'NGN',
        },
      })
    }

    try {
      const transaction = await verifyPaystackTransaction('reference/with space')
      assert.equal(transaction.status, 'success')
      assert.equal(
        capturedUrl,
        'https://api.paystack.co/transaction/verify/reference%2Fwith%20space',
      )
    } finally {
      restoreEnvironment()
    }
  })

  it('accepts a valid webhook HMAC and rejects a different signature', () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_example'
    const body = '{"event":"charge.success"}'
    const signature = createHmac('sha512', 'sk_test_example')
      .update(body)
      .digest('hex')

    try {
      assert.equal(isValidPaystackSignature(body, signature), true)
      assert.equal(isValidPaystackSignature(body, '0'.repeat(128)), false)
      assert.equal(isValidPaystackSignature(body, null), false)
    } finally {
      restoreEnvironment()
    }
  })
})
