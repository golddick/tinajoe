import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { uploadGalleryImage } from '../lib/dropaphi.ts'

describe('public gallery image upload', () => {
  it('uploads gallery images as public files in their category folder', async () => {
    const originalFetch = globalThis.fetch
    const originalApiKey = process.env.DROPAPHI_API_KEY
    process.env.DROPAPHI_API_KEY = 'test-api-key'
    let capturedBody: Record<string, unknown> | undefined

    globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        success: true,
        data: {
          id: 'fil_gallery_test',
          url: 'https://dropaphi.xyz/api/files/fil_gallery_test',
          name: 'birthday-cake.png',
          mimeType: 'image/png',
        },
      })
    }

    try {
      const file = await uploadGalleryImage({
        name: 'birthday-cake.png',
        mimeType: 'image/png',
        base64Data: 'aGVsbG8=',
        folder: 'cake-gallery/birthday-cakes',
      })
      assert.equal(file.id, 'fil_gallery_test')
      assert.deepEqual(capturedBody, {
        name: 'birthday-cake.png',
        type: 'image/png',
        data: 'aGVsbG8=',
        metadata: {
          visibility: 'PUBLIC',
          folder: 'cake-gallery/birthday-cakes',
        },
      })
    } finally {
      globalThis.fetch = originalFetch
      if (originalApiKey === undefined) {
        delete process.env.DROPAPHI_API_KEY
      } else {
        process.env.DROPAPHI_API_KEY = originalApiKey
      }
    }
  })
})
