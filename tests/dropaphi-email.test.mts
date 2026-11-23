import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sendTransactionalEmail } from '../lib/dropaphi.ts'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.DROPAPHI_API_KEY

function restoreEnvironment() {
  globalThis.fetch = originalFetch
  if (originalApiKey === undefined) {
    delete process.env.DROPAPHI_API_KEY
  } else {
    process.env.DROPAPHI_API_KEY = originalApiKey
  }
}

describe('DropAPHI transactional email', () => {
  it('sends an email through the server-side DropAPHI API key', async () => {
    process.env.DROPAPHI_API_KEY = 'da_test_api_key'
    let captured:
      | { url: string; headers: Headers; body: Record<string, unknown> }
      | undefined
    globalThis.fetch = async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }
      return Response.json({
        success: true,
        data: { id: 'email_test', status: 'SENT' },
      })
    }

    try {
      const emailId = await sendTransactionalEmail({
        to: 'customer@example.com',
        subject: 'Payment confirmed',
        text: 'Your payment has been confirmed.',
        html: '<p>Your payment has been confirmed.</p>',
        fromName: 'Crumb Studio',
        metadata: {
          cakeOrderId: 'cake_request_test',
          notificationType: 'payment-confirmation',
        },
      })

      assert.equal(emailId, 'email_test')
      assert.equal(
        captured?.url,
        'https://dropaphi.xyz/api/v1/email/send',
      )
      assert.equal(captured?.headers.get('DROP-API-Key'), 'da_test_api_key')
      assert.deepEqual(captured?.body, {
        to: 'customer@example.com',
        subject: 'Payment confirmed',
        text: 'Your payment has been confirmed.',
        html: '<p>Your payment has been confirmed.</p>',
        fromName: 'Crumb Studio',
        metadata: {
          cakeOrderId: 'cake_request_test',
          notificationType: 'payment-confirmation',
        },
      })
    } finally {
      restoreEnvironment()
    }
  })

  it('surfaces DropAPHI delivery failures', async () => {
    process.env.DROPAPHI_API_KEY = 'da_test_api_key'
    globalThis.fetch = async () =>
      Response.json(
        { success: false, error: 'Email service is unavailable.' },
        { status: 503 },
      )

    try {
      await assert.rejects(
        sendTransactionalEmail({
          to: 'customer@example.com',
          subject: 'Payment confirmed',
          text: 'Your payment has been confirmed.',
          html: '<p>Your payment has been confirmed.</p>',
          fromName: 'Crumb Studio',
        }),
        /Email service is unavailable\./,
      )
    } finally {
      restoreEnvironment()
    }
  })
})
