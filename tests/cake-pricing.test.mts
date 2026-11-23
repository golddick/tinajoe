import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateCakePrice } from '../lib/cake-pricing.ts'
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRODUCT_CATALOG,
  currencyForCountry,
  storefrontCurrency,
  type CurrencyPriceMap,
} from '../lib/pricing-catalog.ts'

function completePrices(currency: 'NGN' | 'EUR' | 'USD', amount: number) {
  const prices: CurrencyPriceMap = {}
  for (const item of DEFAULT_PRODUCT_CATALOG) {
    prices[item.id] = { [currency]: amount }
  }
  return prices
}

describe('independent product pricing', () => {
  it('resolves storefront currency from country and defaults to NGN', () => {
    assert.equal(currencyForCountry('US'), 'USD')
    assert.equal(currencyForCountry('DE'), 'EUR')
    assert.equal(currencyForCountry('GB'), DEFAULT_CURRENCY)
    assert.equal(currencyForCountry(undefined), DEFAULT_CURRENCY)
  })

  it('falls back to the complete NGN catalog when a market is incomplete', () => {
    const prices = completePrices('NGN', 100)
    prices.cake_size_6!.USD = 1
    assert.equal(storefrontCurrency('USD', prices), 'NGN')
  })

  it('uses independent selected-currency values without conversion', () => {
    const prices = completePrices('USD', 0)
    prices.cake_size_6!.USD = 125
    prices.extra_layer!.USD = 20
    prices.flavour_red_velvet!.USD = 7
    prices.frosting_russian_buttercream!.USD = 11
    prices.filling_vanilla_buttercream!.USD = 0
    prices.extra_tier!.USD = 30
    prices.topping_piped_florals!.USD = 15

    assert.equal(
      calculateCakePrice(
        [
          {
            size: 6,
            layers: 3,
            flavourId: 'flavour_red_velvet',
            frostingId: 'frosting_russian_buttercream',
            fillingId: 'filling_vanilla_buttercream',
          },
        ],
        ['topping_piped_florals'],
        prices,
        'USD',
      ),
      178,
    )
  })

  it('returns unavailable when a required product price is missing', () => {
    assert.equal(
      calculateCakePrice(
        [
          {
            size: 6,
            layers: 2,
            flavourId: 'flavour_vanilla_bean',
            frostingId: 'frosting_whipped_cream',
            fillingId: 'filling_vanilla_buttercream',
          },
        ],
        [],
        {},
        'NGN',
      ),
      null,
    )
  })

  it('adds a standalone slice product and selected flavour, frosting and topping prices', () => {
    const prices: CurrencyPriceMap = {
      slice_red_velvet: { NGN: 950 },
      flavour_vanilla_bean: { NGN: 0 },
      frosting_whipped_cream: { NGN: 125 },
      filling_vanilla_buttercream: { NGN: 0 },
      topping_cookies: { NGN: 75 },
    }

    assert.equal(
      calculateCakePrice(
        [
          {
            size: 6,
            layers: 2,
            flavourId: 'flavour_vanilla_bean',
            frostingId: 'frosting_whipped_cream',
            fillingId: 'filling_vanilla_buttercream',
          },
        ],
        ['topping_cookies'],
        prices,
        'NGN',
        'slice_red_velvet',
      ),
      1150,
    )
  })

  it('does not treat a new product without a market price as a converted price', () => {
    const prices = completePrices('NGN', 100)
    const catalogWithSlice = [
      ...DEFAULT_PRODUCT_CATALOG,
      {
        id: 'slice_red_velvet',
        name: 'Red velvet slice',
        category: 'Slice cakes',
        kind: 'base_product' as const,
      },
    ]
    prices.slice_red_velvet = { NGN: 950 }

    assert.equal(storefrontCurrency('USD', prices, catalogWithSlice), 'NGN')
    delete prices.slice_red_velvet
    assert.equal(storefrontCurrency('NGN', prices, catalogWithSlice), null)
  })
})
