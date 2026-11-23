import { NextResponse } from 'next/server'
import {
  formatPhotonSuggestion,
  type PhotonFeatureProperties,
} from '@/lib/address-suggestions'

type PhotonResponse = {
  features?: Array<{
    properties?: PhotonFeatureProperties
    geometry?: { coordinates?: [number, number] }
  }>
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 3 || query.length > 120) {
    return NextResponse.json({ suggestions: [] })
  }

  const endpoint =
    process.env.ADDRESS_SUGGESTIONS_API_URL?.trim() ||
    'https://photon.komoot.io/api/'
  let url: URL
  try {
    url = new URL(endpoint)
    if (url.protocol !== 'https:') {
      throw new Error('Address suggestion endpoint must use HTTPS.')
    }
  } catch {
    console.error('Address suggestion endpoint must be a valid HTTPS URL.')
    return NextResponse.json(
      { error: 'Address search is temporarily unavailable.' },
      { status: 503 },
    )
  }
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'en')

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
      throw new Error(`Address suggestion provider returned ${response.status}.`)
    }

    const result = (await response.json()) as PhotonResponse
    if (!Array.isArray(result.features)) {
      throw new Error('Address suggestion provider returned invalid results.')
    }

    const suggestions = result.features
      .map((feature) => {
        if (!feature.properties) return null
        const suggestion = formatPhotonSuggestion(feature.properties)
        const coordinates = feature.geometry?.coordinates
        if (
          !suggestion ||
          !coordinates ||
          !Number.isFinite(coordinates[0]) ||
          !Number.isFinite(coordinates[1])
        ) {
          return suggestion
        }
        return {
          ...suggestion,
          longitude: coordinates[0],
          latitude: coordinates[1],
        }
      })
      .filter((suggestion) => suggestion !== null)
      .slice(0, 5)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Address suggestions request failed:', error)
    return NextResponse.json(
      { error: 'Address search is temporarily unavailable. Try again.' },
      { status: 502 },
    )
  }
}
