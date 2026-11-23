import { NextResponse } from 'next/server'
import {
  formatPhotonSuggestion,
  type PhotonFeatureProperties,
} from '@/lib/address-suggestions'

type PhotonResponse = {
  features?: Array<{ properties?: PhotonFeatureProperties }>
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const latitude = Number(searchParams.get('lat'))
  const longitude = Number(searchParams.get('lon'))

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: 'Choose a valid point on the map.' },
      { status: 400 },
    )
  }

  const endpoint =
    process.env.ADDRESS_SUGGESTIONS_API_URL?.trim() ||
    'https://photon.komoot.io/api/'
  let url: URL
  try {
    url = new URL(endpoint)
    if (url.protocol !== 'https:') throw new Error('HTTPS is required.')
    url.pathname = url.pathname.replace(/\/api\/?$/, '/reverse/')
    url.searchParams.set('lat', latitude.toString())
    url.searchParams.set('lon', longitude.toString())
    url.searchParams.set('lang', 'en')
  } catch {
    console.error('Address reverse endpoint must be a valid HTTPS URL.')
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable.' },
      { status: 503 },
    )
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Crumb Studio address search/1.0',
        Referer: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Address provider returned ${response.status}.`)
    }

    const result = (await response.json()) as PhotonResponse
    const suggestion = result.features?.[0]?.properties
      ? formatPhotonSuggestion(result.features[0].properties)
      : null
    if (!suggestion) {
      return NextResponse.json(
        { error: 'No address was found at this point. Try another location.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('Address reverse lookup failed:', error)
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable. Try again.' },
      { status: 502 },
    )
  }
}
