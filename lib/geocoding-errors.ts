export type DeliveryGeocodingErrorCode = 'geocode_failed'

export class DeliveryGeocodingError extends Error {
  readonly code: DeliveryGeocodingErrorCode

  constructor(code: DeliveryGeocodingErrorCode) {
    super(code)
    this.code = code
    this.name = 'DeliveryGeocodingError'
  }
}
