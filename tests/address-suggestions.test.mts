import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatPhotonSuggestion } from '../lib/address-suggestions.ts'

describe('formatPhotonSuggestion', () => {
  it('formats an OSM address and keeps its postcode separate', () => {
    assert.deepEqual(
      formatPhotonSuggestion({
        housenumber: '27',
        street: 'Obalende Road',
        city: 'Lagos',
        state: 'Lagos',
        postcode: '100001',
        country: 'Nigeria',
      }),
      {
        address: '27 Obalende Road, Lagos, Nigeria',
        postcode: '100001',
        label: '27 Obalende Road, Lagos, Nigeria, 100001',
      },
    )
  })

  it('uses the place name when no street is available', () => {
    assert.deepEqual(
      formatPhotonSuggestion({
        name: 'Obalende',
        city: 'Lagos',
        country: 'Nigeria',
      }),
      {
        address: 'Obalende, Lagos, Nigeria',
        postcode: '',
        label: 'Obalende, Lagos, Nigeria',
      },
    )
  })

  it('ignores a result without any address details', () => {
    assert.equal(formatPhotonSuggestion({ postcode: '100001' }), null)
  })
})
