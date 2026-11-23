import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseNominatimResults } from '../lib/nominatim-response.ts'

describe('parseNominatimResults', () => {
  it('converts the first Nominatim match to coordinates', () => {
    assert.deepEqual(
      parseNominatimResults([{ lat: '51.5072', lon: '-0.1276' }]),
      { lat: 51.5072, lng: -0.1276 },
    )
  })

  it('returns null when the address has no match', () => {
    assert.equal(parseNominatimResults([]), null)
  })

  it('rejects invalid coordinates', () => {
    assert.throws(() =>
      parseNominatimResults([{ lat: '91', lon: '0' }]),
    )
  })
})
