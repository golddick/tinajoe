import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  sendAdminOtp,
  uploadCakeReferenceImage,
  verifyAdminOtp,
} from '../lib/dropaphi.ts'

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

describe('DropAPHI integration', () => {
  it('sends an OTP through the server-side API key', async () => {
    process.env.DROPAPHI_API_KEY = 'test-api-key'
    let captured: { url: string; headers: Headers; body: Record<string, unknown> } | undefined
    globalThis.fetch = async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      }
      return Response.json({ success: true, data: { id: 'otp_test' } })
    }

    try {
      await sendAdminOtp('admin@example.com')
      assert.equal(captured?.url, 'https://dropaphi.xyz/api/v1/otp/send')
      assert.equal(captured?.headers.get('DROP-API-Key'), 'test-api-key')
      assert.deepEqual(captured?.body, {
        email: 'admin@example.com',
        length: 6,
        expiry: 10,
        brandName: 'crumb.studio',
      })
    } finally {
      restoreEnvironment()
    }
  })

  it('returns the provider verification result', async () => {
    process.env.DROPAPHI_API_KEY = 'test-api-key'
    globalThis.fetch = async () =>
      Response.json({
        success: true,
        data: { verified: true },
      })

    try {
      assert.equal(await verifyAdminOtp('admin@example.com', '123456'), true)
    } finally {
      restoreEnvironment()
    }
  })

  it('uploads base64 data and returns the DropAPHI file metadata', async () => {
    process.env.DROPAPHI_API_KEY = 'test-api-key'
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        success: true,
        data: {
          id: 'fil_test',
          url: 'https://dropaphi.xyz/api/files/fil_test',
          name: 'inspiration.png',
          mimeType: 'image/png',
          size: 1.5,
        },
      })
    }

    try {
      const file = await uploadCakeReferenceImage({
        name: 'inspiration.png',
        mimeType: 'image/png',
        base64Data: 'aGVsbG8=',
      })
      assert.equal(file.id, 'fil_test')
      assert.deepEqual(capturedBody, {
        name: 'inspiration.png',
        type: 'image/png',
        data: 'aGVsbG8=',
        metadata: { visibility: 'PRIVATE', folder: 'cake-inspiration' },
      })
    } finally {
      restoreEnvironment()
    }
  })
})
