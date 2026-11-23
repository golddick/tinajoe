import {
  type Currency,
  type CurrencyPriceMap,
} from './pricing-catalog.ts'

export type PricedCakeTier = {
  size: number
  layers: number
  flavourId: string
  frostingId: string
  fillingId: string
}

export function calculateCakePrice(
  tiers: PricedCakeTier[],
  toppingIds: string[],
  prices: CurrencyPriceMap,
  currency: Currency,
  baseProductId?: string | null,
): number | null {
  let total = 0

  if (baseProductId) {
    const basePrice = prices[baseProductId]?.[currency]
    if (basePrice === undefined) return null
    total += basePrice
  }

  for (const tier of tiers) {
    const items = baseProductId
      ? [tier.flavourId, tier.frostingId, tier.fillingId]
      : [
          `cake_size_${tier.size}`,
          ...Array.from({ length: tier.layers - 2 }, () => 'extra_layer'),
          tier.flavourId,
          tier.frostingId,
          tier.fillingId,
        ]

    for (const id of items) {
      const price = prices[id]?.[currency]
      if (price === undefined) return null
      total += price
    }
  }

  if (!baseProductId && tiers.length > 1) {
    const extraTierPrice = prices.extra_tier?.[currency]
    if (extraTierPrice === undefined) return null
    total += extraTierPrice * (tiers.length - 1)
  }

  for (const toppingId of toppingIds) {
    const price = prices[toppingId]?.[currency]
    if (price === undefined) return null
    total += price
  }

  return total
}
