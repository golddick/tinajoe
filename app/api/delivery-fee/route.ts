import { NextResponse } from 'next/server'
import { calculateDeliveryFee } from '@/lib/delivery-fee'
import { DEFAULT_DELIVERY_FEE_CONFIG } from '@/lib/delivery-fee-config'
import { geocodeAddressWithNominatim } from '@/lib/nominatim-geocoder'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { formatAddressForGeocoding } from '@/lib/geocoding-address'
import { isCurrency } from '@/lib/pricing-catalog'

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const body = payload as {
    address?: unknown
    postcode?: unknown
    currency?: unknown
  }
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const postcode =
    typeof body.postcode === 'string' ? body.postcode.trim() : ''

  if (
    !address ||
    address.length > 500 ||
    (body.postcode !== undefined &&
      (typeof body.postcode !== 'string' || postcode.length > 30)) ||
    !isCurrency(body.currency)
  ) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const currency = body.currency
  const settings = await getDeliverySettings()
  if (!settings.bakeryCoordinates) {
    return NextResponse.json(
      { deliverable: false, error: 'bakery_address_not_configured' },
      { status: 503 },
    )
  }
  const deliveryPrice = settings.deliveryPrices[currency]
  const perKmRate = settings.deliveryPerKmRates[currency]
  if (deliveryPrice === undefined || perKmRate === undefined) {
    return NextResponse.json(
      { deliverable: false, error: 'delivery_price_not_configured' },
      { status: 503 },
    )
  }

  const result = await calculateDeliveryFee({
    address: formatAddressForGeocoding(address, postcode),
    geocodeAddress: geocodeAddressWithNominatim,
    config: {
      ...DEFAULT_DELIVERY_FEE_CONFIG,
      bakeryLat: settings.bakeryCoordinates.lat,
      bakeryLng: settings.bakeryCoordinates.lng,
      baseFee: deliveryPrice,
      perKmRate,
    },
  })

  if (!result.deliverable) {
    const error = 'error' in result ? result.error : 'outside_delivery_area'
    const status =
      error === 'geocode_failed'
        ? 422
        : error === 'invalid_coordinates'
          ? 400
          : 200
    return NextResponse.json({ deliverable: false, error }, { status })
  }

  return NextResponse.json({
    deliverable: true,
    distanceKm: result.distanceKm,
    fee: result.fee,
    currency,
  })
}
