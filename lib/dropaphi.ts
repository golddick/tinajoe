const DROPAPHI_API_BASE_URL = 'https://dropaphi.xyz/api/v1'

type DropaphiResponse = {
  success?: boolean
  data?: {
    verified?: boolean
    id?: string
    url?: string
    name?: string
    mimeType?: string
    size?: number
  }
  error?: string
  message?: string
}

function getApiKey() {
  const apiKey = process.env.DROPAPHI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DROPAPHI_API_KEY is not configured.')
  }
  return apiKey
}

export function assertDropaphiConfiguration() {
  getApiKey()
}

async function dropaphiRequest(
  path: string,
  init: RequestInit,
): Promise<DropaphiResponse> {
  const response = await fetch(`${DROPAPHI_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'DROP-API-Key': getApiKey(),
      ...init.headers,
    },
    cache: 'no-store',
  })

  let result: DropaphiResponse
  try {
    result = (await response.json()) as DropaphiResponse
  } catch {
    throw new Error(`DropAPHI returned an invalid response (${response.status}).`)
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.error ||
        result.message ||
        `DropAPHI request failed (${response.status}).`,
    )
  }

  return result
}

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  text: string
  html: string
  fromName: string
  metadata?: Record<string, string>
}) {
  const result = await dropaphiRequest('/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!result.data?.id) {
    throw new Error('DropAPHI did not return the sent email details.')
  }
  return result.data.id
}

export async function sendAdminOtp(email: string) {
  await dropaphiRequest('/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      length: 6,
      expiry: 10,
      brandName: 'TinaJoe.studio',
    }),
  })
}

export async function verifyAdminOtp(email: string, code: string) {
  const result = await dropaphiRequest('/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })

  return result.data?.verified === true
}

export async function uploadCakeReferenceImage(input: {
  name: string
  mimeType: string
  base64Data: string
}) {
  const result = await dropaphiRequest('/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      type: input.mimeType,
      data: input.base64Data,
      metadata: {
        visibility: 'PRIVATE',
      },
    }),
  })

  const file = result.data
  if (!file?.id || !file.url) {
    throw new Error('DropAPHI did not return the uploaded file details.')
  }

  return {
    id: file.id,
    url: file.url,
    name: file.name ?? input.name,
    mimeType: file.mimeType ?? input.mimeType,
    size: file.size,
  }
}

export async function uploadGalleryImage(input: {
  name: string
  mimeType: string
  base64Data: string
  folder: string
}) {
  const result = await dropaphiRequest('/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      type: input.mimeType,
      data: input.base64Data,
      metadata: {
        visibility: 'PUBLIC',
        // folder: input.folder,
      },
    }),
  })

  const file = result.data
  if (!file?.id || !file.url) {
    throw new Error('DropAPHI did not return the uploaded gallery image details.')
  }

  return {
    id: file.id,
    url: file.url,
    name: file.name ?? input.name,
    mimeType: file.mimeType ?? input.mimeType,
    size: file.size,
  }
}
