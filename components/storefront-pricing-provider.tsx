'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  type Currency,
  type CurrencyPriceMap,
  type ProductCatalogItem,
  formatCurrency,
  storefrontCurrency,
} from '@/lib/pricing-catalog'

type StorefrontPricing = {
  preferredCurrency: Currency
  currency: Currency | null
  prices: CurrencyPriceMap
  catalog: ProductCatalogItem[]
  setPreferredCurrency: (currency: Currency) => void
  price: (productId: string) => number | undefined
  formatPrice: (productId: string) => string
}

const PricingContext = createContext<StorefrontPricing | null>(null)

export function StorefrontPricingProvider({
  children,
  initialCurrency,
  prices,
  catalog,
}: {
  children: ReactNode
  initialCurrency: Currency
  prices: CurrencyPriceMap
  catalog: ProductCatalogItem[]
}) {
  const [preferredCurrency, setPreferredCurrencyState] =
    useState(initialCurrency)
  const currency = useMemo(
    () => storefrontCurrency(preferredCurrency, prices, catalog),
    [catalog, preferredCurrency, prices],
  )

  const setPreferredCurrency = (nextCurrency: Currency) => {
    setPreferredCurrencyState(nextCurrency)
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `store_currency=${nextCurrency}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  }

  const value = useMemo<StorefrontPricing>(
    () => ({
      preferredCurrency,
      currency,
      prices,
      catalog,
      setPreferredCurrency,
      price: (productId) =>
        currency ? prices[productId]?.[currency] : undefined,
      formatPrice: (productId) => {
        const amount = currency ? prices[productId]?.[currency] : undefined
        return amount === undefined || currency === null
          ? 'Pricing being configured'
          : formatCurrency(amount, currency)
      },
    }),
    [catalog, currency, preferredCurrency, prices],
  )

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
}

export function useStorefrontPricing() {
  const context = useContext(PricingContext)
  if (!context) {
    throw new Error(
      'useStorefrontPricing must be used within StorefrontPricingProvider.',
    )
  }
  return context
}

export function CurrencySelector() {
  const { preferredCurrency, currency, setPreferredCurrency } =
    useStorefrontPricing()

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Display prices in</span>
      <select
        value={preferredCurrency}
        onChange={(event) =>
          setPreferredCurrency(event.target.value as Currency)
        }
        aria-label="Display prices in"
        className="rounded-full border border-border bg-background px-3 py-2"
      >
        <option value="NGN">NGN ₦</option>
        <option value="EUR">EUR €</option>
        <option value="USD">USD $</option>
      </select>
      {currency && currency !== preferredCurrency ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Showing NGN until {preferredCurrency} prices are set
        </span>
      ) : null}
      {!currency ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Prices are being configured
        </span>
      ) : null}
    </label>
  )
}
