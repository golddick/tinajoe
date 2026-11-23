import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateDeliveryFee,
  type DeliveryFeeConfig,
} from '../lib/delivery-fee.ts'

const EARTH_RADIUS_KM = 6371.0088
const config: DeliveryFeeConfig = {
  bakeryLat: 0,
  bakeryLng: 0,
  baseRadiusKm: 5,
  baseFee: 100,
  perKmRate: 20,
  maxRadiusKm: 30,
}

function destinationAtDistance(distanceKm: number) {
  const longitudeRadians = distanceKm / EARTH_RADIUS_KM
  return { lat: 0, lng: (longitudeRadians * 180) / Math.PI }
}

describe('calculateDeliveryFee', () => {
  it('charges only the base fee at exactly the 5 km base radius', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(5),
      config,
    })

    assert.equal(result.deliverable, true)
    if (result.deliverable) {
      assert.equal(result.distanceKm, 5)
      assert.equal(result.fee, 100)
    }
  })

  it('adds the per-kilometre rate above the 5 km base radius', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(5.1),
      config,
    })

    assert.equal(result.deliverable, true)
    if (result.deliverable) {
      assert.equal(result.distanceKm, 5.1)
      assert.ok(Math.abs(result.fee - 102) < 1e-8)
    }
  })

  it('calculates from a market-specific base price and per-kilometre rate', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(8),
      config: { ...config, baseFee: 250, perKmRate: 35 },
    })

    assert.equal(result.deliverable, true)
    if (result.deliverable) {
      assert.equal(result.distanceKm, 8)
      assert.equal(result.fee, 355)
    }
  })

  it('uses an admin-configured flat fee instead of the distance formula', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(18),
      config: { ...config, flatFee: 12.5 },
    })

    assert.equal(result.deliverable, true)
    if (result.deliverable) {
      assert.equal(result.distanceKm, 18)
      assert.equal(result.fee, 12.5)
    }
  })

  it('allows delivery at exactly the configured maximum radius', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(config.maxRadiusKm),
      config,
    })

    assert.equal(result.deliverable, true)
    if (result.deliverable) {
      assert.equal(result.distanceKm, config.maxRadiusKm)
      assert.equal(
        result.fee,
        config.baseFee + (config.maxRadiusKm - config.baseRadiusKm) * config.perKmRate,
      )
    }
  })

  it('rejects delivery beyond the configured maximum radius', async () => {
    const result = await calculateDeliveryFee({
      coordinates: destinationAtDistance(config.maxRadiusKm + 0.1),
      config,
    })

    assert.deepEqual(result, { deliverable: false })
  })

  it('returns geocode_failed when the address cannot be geocoded', async () => {
    const result = await calculateDeliveryFee({
      address: 'Unknown address',
      geocodeAddress: async () => null,
      config,
    })

    assert.deepEqual(result, { deliverable: false, error: 'geocode_failed' })
  })

  it('returns geocode_failed when the geocoder throws', async () => {
    const result = await calculateDeliveryFee({
      address: 'Unknown address',
      geocodeAddress: async () => {
        throw new Error('Geocoding service unavailable')
      },
      config,
    })

    assert.deepEqual(result, { deliverable: false, error: 'geocode_failed' })
  })

})
