export type PhotonFeatureProperties = {
  name?: string
  housenumber?: string
  street?: string
  district?: string
  city?: string
  locality?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

export type AddressSuggestion = {
  label: string
  address: string
  postcode: string
  latitude?: number
  longitude?: number
}

export function formatPhotonSuggestion(
  properties: PhotonFeatureProperties,
): AddressSuggestion | null {
  const streetAddress = [
    properties.housenumber,
    properties.street ?? properties.name,
  ]
    .filter(Boolean)
    .join(' ')
  const address = [
    streetAddress,
    properties.district,
    properties.city ?? properties.locality,
    properties.county,
    properties.state,
    properties.country,
  ]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ')
  const postcode = properties.postcode?.trim() ?? ''

  if (!address) return null

  return {
    address,
    postcode,
    label: [address, postcode].filter(Boolean).join(', '),
  }
}
