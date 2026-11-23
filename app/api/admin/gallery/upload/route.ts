import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getAdminSession } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { galleryCategories } from '@/lib/db/schema'
import { uploadGalleryImage } from '@/lib/dropaphi'

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function matchesImageType(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    )
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

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }

  const body = payload as {
    name?: unknown
    mimeType?: unknown
    data?: unknown
    categoryId?: unknown
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const mimeType =
    typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : ''
  const base64Data = typeof body.data === 'string' ? body.data : ''

  if (
    typeof body.categoryId !== 'string' ||
    !body.categoryId.trim() ||
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

  const [category] = await db
    .select({
      id: galleryCategories.id,
      name: galleryCategories.name,
    })
    .from(galleryCategories)
    .where(
      and(
        eq(galleryCategories.id, body.categoryId.trim()),
        eq(galleryCategories.active, true),
      ),
    )
    .limit(1)
  if (!category) {
    return NextResponse.json(
      { error: 'Create or select a gallery category before uploading.' },
      { status: 400 },
    )
  }
  const categoryFolder =
    category.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `category-${category.id}`

  try {
    const file = await uploadGalleryImage({
      name,
      mimeType,
      base64Data,
      folder: `cake-gallery/${categoryFolder}`,
    })
    return NextResponse.json({ file })
  } catch (error) {
    console.error('Gallery image upload failed:', error)
    return NextResponse.json(
      { error: 'The image could not be uploaded. Please try again.' },
      { status: 502 },
    )
  }
}
