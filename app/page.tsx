import CakeBuilder from '@/components/cake-builder'
import {
  CollectionSection,
  GallerySection,
  HeroSection,
  SiteFooter,
} from '@/components/homepage-sections'
import SiteHeader from '@/components/site-header'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { MAX_RADIUS_KM } from '@/lib/delivery-fee-config'
import { getGalleryContent } from '@/lib/gallery'
import { getProductPriceCatalog } from '@/lib/product-prices'
import { db } from '@/lib/db'
import { blockedDates } from '@/lib/db/schema'
import { cookies, headers } from 'next/headers'
import {
  currencyForCountry,
  DEFAULT_CURRENCY,
  isCurrency,
} from '@/lib/pricing-catalog'
import { StorefrontPricingProvider } from '@/components/storefront-pricing-provider'

export default async function HomePage() {
  const [
    deliverySettings,
    pricingCatalog,
    galleryContent,
    blockedDateRows,
    cookieStore,
    requestHeaders,
  ] =
    await Promise.all([
      getDeliverySettings(),
      getProductPriceCatalog(),
      getGalleryContent(),
      db.select({ date: blockedDates.date }).from(blockedDates).orderBy(blockedDates.date),
      cookies(),
      headers(),
    ])
  const country =
    requestHeaders.get('x-vercel-ip-country') ??
    requestHeaders.get('cf-ipcountry') ??
    requestHeaders.get('x-country-code')
  const savedCurrency = cookieStore.get('store_currency')?.value
  const initialCurrency = isCurrency(savedCurrency)
    ? savedCurrency
    : country
      ? currencyForCountry(country)
      : DEFAULT_CURRENCY

  return (
    <StorefrontPricingProvider
      initialCurrency={initialCurrency}
      prices={pricingCatalog.prices}
      catalog={pricingCatalog.catalog}
    >
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <HeroSection />
        <CollectionSection />
        <CakeBuilder
          maxDeliveryKm={MAX_RADIUS_KM}
          blockedDates={blockedDateRows.map(({ date }) => date)}
        />
        <GallerySection items={galleryContent.items} />
        <SiteFooter
          studioEmail={deliverySettings.studioEmail}
          studioPhone={deliverySettings.studioPhone}
        />
      </main>
    </StorefrontPricingProvider>
  )
}
