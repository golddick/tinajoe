export const BASE_RADIUS_KM = 5
const configuredBaseFee = Number(process.env.BASE_FEE)
const configuredPerKmRate = Number(process.env.PER_KM_RATE)
const configuredMaxRadiusKm = Number(process.env.Max_Km)
export const BASE_FEE =
  Number.isFinite(configuredBaseFee) && configuredBaseFee >= 0
    ? configuredBaseFee
    : 0
export const PER_KM_RATE =
  Number.isFinite(configuredPerKmRate) && configuredPerKmRate >= 0
    ? configuredPerKmRate
    : 0
if (
  !process.env.Max_Km?.trim() ||
  !Number.isFinite(configuredMaxRadiusKm) ||
  configuredMaxRadiusKm < BASE_RADIUS_KM
) {
  throw new Error(
    `Max_Km must be configured as a number greater than or equal to ${BASE_RADIUS_KM}.`,
  )
}
export const MAX_RADIUS_KM = configuredMaxRadiusKm

export const DEFAULT_DELIVERY_FEE_CONFIG = {
  baseRadiusKm: BASE_RADIUS_KM,
  baseFee: BASE_FEE,
  perKmRate: PER_KM_RATE,
  maxRadiusKm: MAX_RADIUS_KM,
} as const
