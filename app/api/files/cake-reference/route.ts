import { NextResponse } from 'next/server'
import { uploadCakeReferenceImage } from '@/lib/dropaphi'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function matchesImageType(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
  }
  return (
    mimeType === 'image/webp' &&
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
}

type UploadRequest = {
  name?: unknown
  mimeType?: unknown
  data?: unknown
}

export async function POST(request: Request) {
  let payload: UploadRequest
  try {
    payload = (await request.json()) as UploadRequest
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const mimeType =
    typeof payload.mimeType === 'string' ? payload.mimeType.toLowerCase() : ''
  const base64Data = typeof payload.data === 'string' ? payload.data : ''

  if (
    !name ||
    name.length > 180 ||
    /[\\/\u0000-\u001f]/.test(name) ||
    !ALLOWED_MIME_TYPES.has(mimeType) ||
    !base64Data ||
    base64Data.length > Math.ceil(MAX_FILE_SIZE_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64Data,
    )
  ) {
    return NextResponse.json(
      { error: 'Choose a JPG, PNG, or WebP image up to 2 MB.' },
      { status: 400 },
    )
  }

  const fileBytes = Buffer.from(base64Data, 'base64')
  if (
    fileBytes.length === 0 ||
    fileBytes.length > MAX_FILE_SIZE_BYTES ||
    fileBytes.toString('base64') !== base64Data ||
    !matchesImageType(fileBytes, mimeType)
  ) {
    return NextResponse.json(
      { error: 'Choose a JPG, PNG, or WebP image up to 2 MB.' },
      { status: 400 },
    )
  }

  try {
    const uploadedFile = await uploadCakeReferenceImage({
      name,
      mimeType,
      base64Data,
    })
    return NextResponse.json({
      file: { ...uploadedFile, size: fileBytes.length },
    })
  } catch (error) {
    console.error('Cake reference upload failed:', error)
    return NextResponse.json(
      { error: 'The image could not be uploaded. Please try again.' },
      { status: 502 },
    )
  }
}
