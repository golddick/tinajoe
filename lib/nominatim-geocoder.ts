import { createHash } from 'node:crypto'
import { pool } from '@/lib/db'
import type { Coordinates } from '@/lib/delivery-fee'
import { DeliveryGeocodingError } from '@/lib/geocoding-errors'
import {
  parseNominatimResults,
  type NominatimResult,
} from '@/lib/nominatim-response'

const RATE_LIMITER_ID = 'nominatim'
const RATE_LIMITER_LOCK = 184762
const MIN_REQUEST_INTERVAL_MS = 1000

export async function geocodeAddressWithNominatim(
  address: string,
): Promise<Coordinates | null> {
  const normalizedAddress = address.trim().replace(/\s+/g, ' ')
  if (!normalizedAddress || normalizedAddress.length > 500) {
    throw new DeliveryGeocodingError('geocode_failed')
  }
  const addressHash = createHash('sha256')
    .update(normalizedAddress.toLocaleLowerCase('en-GB'))
    .digest('hex')
  const client = await pool.connect()
  let transactionOpen = false

  try {
    await client.query('BEGIN')
    transactionOpen = true
    await client.query(
      'SELECT pg_advisory_xact_lock($1::bigint)',
      [RATE_LIMITER_LOCK],
    )
    await client.query(
      `DELETE FROM geocoding_cache
       WHERE created_at < clock_timestamp() - interval '30 days'`,
    )

    const cached = await client.query<{
      latitude: string | null
      longitude: string | null
    }>(
      'SELECT latitude, longitude FROM geocoding_cache WHERE address_hash = $1',
      [addressHash],
    )
    if (cached.rows.length > 0) {
      await client.query('COMMIT')
      transactionOpen = false
      const { latitude, longitude } = cached.rows[0]
      return latitude === null || longitude === null
        ? null
        : { lat: Number(latitude), lng: Number(longitude) }
    }

    const limiter = await client.query<{ last_request_at: Date }>(
      'SELECT last_request_at FROM geocoding_service_state WHERE id = $1',
      [RATE_LIMITER_ID],
    )
    if (limiter.rows.length > 0) {
      const elapsed =
        Date.now() - new Date(limiter.rows[0].last_request_at).getTime()
      const remaining = MIN_REQUEST_INTERVAL_MS - elapsed
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining))
      }
    }
    await client.query(
      `INSERT INTO geocoding_service_state (id, last_request_at)
       VALUES ($1, clock_timestamp())
       ON CONFLICT (id) DO UPDATE
       SET last_request_at = clock_timestamp()`,
      [RATE_LIMITER_ID],
    )

    let coordinates: Coordinates | null
    try {
      coordinates = await fetchNominatimCoordinates(normalizedAddress)
    } catch (error) {
      await client.query('COMMIT')
      transactionOpen = false
      throw error
    }

    await client.query(
      `INSERT INTO geocoding_cache (address_hash, latitude, longitude)
       VALUES ($1, $2, $3)
       ON CONFLICT (address_hash) DO UPDATE
       SET latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           created_at = now()`,
      [addressHash, coordinates?.lat ?? null, coordinates?.lng ?? null],
    )
    await client.query('COMMIT')
    transactionOpen = false
    return coordinates
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK')
    }
    if (error instanceof DeliveryGeocodingError) throw error
    throw new DeliveryGeocodingError('geocode_failed')
  } finally {
    client.release()
  }
}

async function fetchNominatimCoordinates(
  address: string,
): Promise<Coordinates | null> {
  const endpoint =
    process.env.NOMINATIM_API_URL?.trim() ||
    'https://nominatim.openstreetmap.org/search'
  let url: URL
  try {
    url = new URL(endpoint)
    if (url.protocol !== 'https:') {
      throw new Error('Nominatim endpoint must use HTTPS.')
    }
  } catch {
    throw new DeliveryGeocodingError('geocode_failed')
  }
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Crumb Studio delivery geocoder/1.0',
        Referer: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
  } catch {
    throw new DeliveryGeocodingError('geocode_failed')
  }
  if (!response.ok) {
    throw new DeliveryGeocodingError('geocode_failed')
  }

  let results: NominatimResult[]
  try {
    results = (await response.json()) as NominatimResult[]
  } catch {
    throw new DeliveryGeocodingError('geocode_failed')
  }
  if (!Array.isArray(results)) {
    throw new DeliveryGeocodingError('geocode_failed')
  }

  try {
    return parseNominatimResults(results)
  } catch {
    throw new DeliveryGeocodingError('geocode_failed')
  }
}
