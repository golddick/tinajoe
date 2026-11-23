import type { Coordinates } from './delivery-fee.ts'

export type NominatimResult = {
  lat?: string
  lon?: string
}

export function parseNominatimResults(
  results: NominatimResult[],
): Coordinates | null {
  const result = results[0]
  if (!result) return null
  const lat = Number(result.lat)
  const lng = Number(result.lon)
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error('Nominatim returned invalid coordinates.')
  }
  return { lat, lng }
}
