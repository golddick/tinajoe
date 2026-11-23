import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatAddressForGeocoding } from '../lib/geocoding-address.ts'

describe('formatAddressForGeocoding', () => {
  it('places a postcode before the country for selected addresses', () => {
    assert.equal(
      formatAddressForGeocoding(
        'University of Ibadan, Ibadan North, Oyo, Nigeria',
        '200213',
      ),
      'University of Ibadan, Ibadan North, Oyo, 200213, Nigeria',
    )
  })

  it('does not duplicate a postcode already included in the address', () => {
    assert.equal(
      formatAddressForGeocoding(
        'University of Ibadan, Ibadan North, Oyo, 200213, Nigeria',
        '200213',
      ),
      'University of Ibadan, Ibadan North, Oyo, 200213, Nigeria',
    )
  })

  it('handles addresses without a country component', () => {
    assert.equal(
      formatAddressForGeocoding('27 Obalende Road', '100001'),
      '27 Obalende Road, 100001',
    )
  })
})
