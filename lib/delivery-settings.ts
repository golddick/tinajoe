import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deliveryPrices, deliverySettings } from '@/lib/db/schema'
import { isCurrency, type Currency } from '@/lib/pricing-catalog'

export async function getDeliverySettings() {
  const [settingRows, priceRows] = await Promise.all([
    db
      .select({
        flatFee: deliverySettings.flatFee,
        studioEmail: deliverySettings.studioEmail,
        studioPhone: deliverySettings.studioPhone,
        bakeryAddress: deliverySettings.bakeryAddress,
        bakeryLatitude: deliverySettings.bakeryLatitude,
        bakeryLongitude: deliverySettings.bakeryLongitude,
      })
      .from(deliverySettings)
      .where(eq(deliverySettings.id, 'global'))
      .limit(1),
    db.select().from(deliveryPrices),
  ])
  const [setting] = settingRows

  const configuredBaseFee = Number(process.env.BASE_FEE)
  const fallbackFee =
    Number.isFinite(configuredBaseFee) && configuredBaseFee >= 0
      ? configuredBaseFee
      : 0
  const prices: Partial<Record<Currency, number>> = {}
  const perKmRates: Partial<Record<Currency, number>> = {}
  for (const row of priceRows) {
    const amount = Number(row.amount)
    const perKmAmount = Number(row.perKmAmount)
    if (
      isCurrency(row.currency) &&
      Number.isFinite(amount) &&
      Number.isFinite(perKmAmount)
    ) {
      prices[row.currency] = amount
      perKmRates[row.currency] = perKmAmount
    }
  }
  return {
    flatFee: setting ? Number(setting.flatFee) : fallbackFee,
    deliveryPrices: prices,
    deliveryPerKmRates: perKmRates,
    studioEmail: setting?.studioEmail ?? 'hello@crumb.studio',
    studioPhone: setting?.studioPhone ?? '+44 7700 900000',
    bakeryAddress: setting?.bakeryAddress ?? '',
    bakeryCoordinates:
      setting?.bakeryLatitude !== null &&
      setting?.bakeryLatitude !== undefined &&
      setting?.bakeryLongitude !== null &&
      setting?.bakeryLongitude !== undefined
        ? {
            lat: Number(setting.bakeryLatitude),
            lng: Number(setting.bakeryLongitude),
          }
        : null,
  }
}

export async function getFlatDeliveryFee() {
  const settings = await getDeliverySettings()
  return settings.flatFee
}
