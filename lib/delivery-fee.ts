import { DeliveryGeocodingError } from './geocoding-errors.ts'

export type Coordinates = {
  lat: number
  lng: number
}

export type DeliveryFeeConfig = {
  bakeryLat: number
  bakeryLng: number
  baseRadiusKm: number
  baseFee: number
  perKmRate: number
  maxRadiusKm: number
  flatFee?: number
}

export type GeocodeAddress = (address: string) => Promise<Coordinates | null>

export type DeliveryFeeResult =
  | { deliverable: false }
  | {
      deliverable: false
      error: 'geocode_failed' | 'invalid_coordinates'
    }
  | {
      deliverable: true
      distanceKm: number
      fee: number
      lat: number
      lng: number
    }

type CalculateDeliveryFeeInput = {
  address?: string
  coordinates?: Coordinates
  geocodeAddress?: GeocodeAddress
  config: DeliveryFeeConfig
}

const EARTH_RADIUS_KM = 6371.0088
const DISTANCE_EPSILON_KM = 1e-6

export function haversineDistanceKm(from: Coordinates, to: Coordinates) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to.lat - from.lat)
  const longitudeDelta = toRadians(to.lng - from.lng)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine))
}

export async function calculateDeliveryFee({
  address,
  coordinates,
  geocodeAddress,
  config,
}: CalculateDeliveryFeeInput): Promise<DeliveryFeeResult> {
  let destination = coordinates

  if (!destination) {
    if (!address?.trim() || !geocodeAddress) {
      return { deliverable: false, error: 'geocode_failed' }
    }

    try {
      destination = await geocodeAddress(address.trim()) ?? undefined
    } catch (error) {
      return {
        deliverable: false,
        error:
          error instanceof DeliveryGeocodingError
            ? error.code
            : 'geocode_failed',
      }
    }

    if (!destination) {
      return { deliverable: false, error: 'geocode_failed' }
    }
  }

  if (!isValidCoordinates(destination)) {
    return { deliverable: false, error: 'invalid_coordinates' }
  }

  assertValidConfig(config)

  const distance = haversineDistanceKm(
    { lat: config.bakeryLat, lng: config.bakeryLng },
    destination,
  )

  if (distance - config.maxRadiusKm > DISTANCE_EPSILON_KM) {
    return { deliverable: false }
  }

  const billableDistance = Math.round(distance * 1e6) / 1e6
  const excessDistance = Math.max(0, billableDistance - config.baseRadiusKm)
  const fee =
    config.flatFee ?? config.baseFee + excessDistance * config.perKmRate

  return {
    deliverable: true,
    distanceKm: Math.round(distance * 10) / 10,
    fee,
    lat: destination.lat,
    lng: destination.lng,
  }
}

function isValidCoordinates(value: Coordinates) {
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  )
}

function assertValidConfig(config: DeliveryFeeConfig) {
  const validCoordinates =
    Number.isFinite(config.bakeryLat) &&
    config.bakeryLat >= -90 &&
    config.bakeryLat <= 90 &&
    Number.isFinite(config.bakeryLng) &&
    config.bakeryLng >= -180 &&
    config.bakeryLng <= 180
  const validDistance =
    Number.isFinite(config.baseRadiusKm) &&
    config.baseRadiusKm >= 0 &&
    Number.isFinite(config.maxRadiusKm) &&
    config.maxRadiusKm >= config.baseRadiusKm
  const validPricing =
    config.flatFee === undefined
      ? Number.isFinite(config.baseFee) &&
        config.baseFee >= 0 &&
        Number.isFinite(config.perKmRate) &&
        config.perKmRate >= 0
      : Number.isFinite(config.flatFee) && config.flatFee >= 0

  if (!validCoordinates || !validDistance || !validPricing) {
    throw new Error('Delivery fee configuration is missing or invalid.')
  }
}
