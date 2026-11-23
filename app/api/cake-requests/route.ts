import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import {
  calculateDeliveryFee,
  type DeliveryFeeConfig,
} from '@/lib/delivery-fee'
import { DEFAULT_DELIVERY_FEE_CONFIG } from '@/lib/delivery-fee-config'
import { geocodeAddressWithNominatim } from '@/lib/nominatim-geocoder'
import { db } from '@/lib/db'
import { blockedDates } from '@/lib/db/schema'
import {
  cakeRequestFiles,
  cakeRequests,
  cakeRequestTiers,
  customers,
  type CakeDesign,
  type CakeTier,
} from '@/lib/db/schema'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { formatAddressForGeocoding } from '@/lib/geocoding-address'
import { calculateCakePrice } from '@/lib/cake-pricing'
import { getProductPriceCatalog } from '@/lib/product-prices'
import { assertCustomerEmailConfiguration } from '@/lib/customer-email'
import {
  assertPaystackConfiguration,
  initializePaystackTransaction,
} from '@/lib/paystack'
import {
  DEFAULT_CURRENCY,
  isCurrency,
  type ProductKind,
  storefrontCurrency,
} from '@/lib/pricing-catalog'

type RequestPayload = {
  category?: unknown
  customer?: {
    name?: unknown
    email?: unknown
    phone?: unknown
    date?: unknown
    fulfillment?: unknown
    address?: unknown
    postcode?: unknown
  }
  tiers?: unknown
  design?: unknown
  estimate?: unknown
  currency?: unknown
  referenceImage?: unknown
}

type ReferenceImagePayload = {
  id?: unknown
  url?: unknown
  name?: unknown
  mimeType?: unknown
  size?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isCakeTier(value: unknown): value is CakeTier {
  if (!isRecord(value)) return false
  return (
    Number.isInteger(value.size) &&
    Number(value.size) >= 4 &&
    Number(value.size) <= 12 &&
    Number.isInteger(value.layers) &&
    Number(value.layers) >= 2 &&
    Number(value.layers) <= 4 &&
    typeof value.flavour === 'string' &&
    value.flavour.length <= 60 &&
    typeof value.flavourId === 'string' &&
    typeof value.frosting === 'string' &&
    value.frosting.length <= 60 &&
    typeof value.frostingId === 'string' &&
    typeof value.filling === 'string' &&
    value.filling.length <= 60 &&
    typeof value.fillingId === 'string'
  )
}

function isCakeDesign(value: unknown): value is CakeDesign {
  if (!isRecord(value)) return false
  return (
    typeof value.colour === 'string' &&
    typeof value.secondColour === 'string' &&
    value.colour.length <= 60 &&
    value.secondColour.length <= 60 &&
    typeof value.ombre === 'boolean' &&
    typeof value.design === 'string' &&
    value.design.length <= 60 &&
    Array.isArray(value.toppings) &&
    value.toppings.length <= 12 &&
    value.toppings.every((item) => typeof item === 'string') &&
    value.toppings.every((item) => item.length <= 80) &&
    Array.isArray(value.toppingIds) &&
    value.toppingIds.length <= 12 &&
    value.toppingIds.every((item) => typeof item === 'string') &&
    (value.baseProductId === null ||
      typeof value.baseProductId === 'string') &&
    (value.baseProductName === undefined ||
      (typeof value.baseProductName === 'string' &&
        value.baseProductName.length <= 100)) &&
    typeof value.topper === 'string' &&
    value.topper.length <= 160 &&
    typeof value.notes === 'string' &&
    value.notes.length <= 2000
  )
}

function isReferenceImage(value: unknown): value is ReferenceImagePayload {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length <= 200 &&
    typeof value.url === 'string' &&
    value.url === `https://dropaphi.xyz/api/files/${value.id}` &&
    typeof value.name === 'string' &&
    value.name.length <= 180 &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(
      String(value.mimeType),
    ) &&
    Number.isInteger(value.size) &&
    Number(value.size) > 0 &&
    Number(value.size) <= 2 * 1024 * 1024
  )
}

export async function POST(request: Request) {
  let payload: RequestPayload
  try {
    payload = (await request.json()) as RequestPayload
  } catch {
    return NextResponse.json({ error: 'Invalid cake request.' }, { status: 400 })
  }

  const customer = isRecord(payload.customer) ? payload.customer : null
  const name = typeof customer?.name === 'string' ? customer.name.trim() : ''
  const email =
    typeof customer?.email === 'string'
      ? customer.email.trim().toLowerCase()
      : ''
  const phone = typeof customer?.phone === 'string' ? customer.phone.trim() : ''
  const preferredDate =
    typeof customer?.date === 'string' ? customer.date : ''
  const fulfillment =
    customer?.fulfillment === 'Delivery' ? 'Delivery' : 'Collection'
  const address =
    typeof customer?.address === 'string' ? customer.address.trim() : ''
  const postcode =
    typeof customer?.postcode === 'string'
      ? customer.postcode.trim()
      : ''
  const category =
    typeof payload.category === 'string' ? payload.category.trim() : ''
  const requestedCurrency =
    payload.currency === undefined
      ? DEFAULT_CURRENCY
      : payload.currency
  const tiers = Array.isArray(payload.tiers) ? payload.tiers : []
  const design = payload.design
  const parsedPreferredDate = new Date(`${preferredDate}T00:00:00.000Z`)

  if (
    !name ||
    name.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 320 ||
    !phone ||
    phone.length > 40 ||
    !category ||
    category.length > 120 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
    Number.isNaN(parsedPreferredDate.getTime()) ||
    parsedPreferredDate.toISOString().slice(0, 10) !== preferredDate ||
    !['Collection', 'Delivery'].includes(String(customer?.fulfillment)) ||
    (fulfillment === 'Delivery' &&
      (!address || address.length > 500 || !postcode || postcode.length > 30)) ||
    !isCurrency(requestedCurrency) ||
    tiers.length < 1 ||
    tiers.length > 4 ||
    !tiers.every(isCakeTier) ||
    !isCakeDesign(design) ||
    (payload.referenceImage !== null &&
      payload.referenceImage !== undefined &&
      !isReferenceImage(payload.referenceImage))
  ) {
    return NextResponse.json({ error: 'Check the cake request details.' }, { status: 400 })
  }

  const [unavailableDate] = await db
    .select({ date: blockedDates.date })
    .from(blockedDates)
    .where(eq(blockedDates.date, preferredDate))
    .limit(1)
  if (unavailableDate) {
    return NextResponse.json(
      { error: 'That date is unavailable. Please choose another date.' },
      { status: 409 },
    )
  }

  const { catalog, prices } = await getProductPriceCatalog()
  const currency = storefrontCurrency(requestedCurrency, prices, catalog)
  if (!currency) {
    return NextResponse.json(
      { error: 'Cake prices are not configured yet.' },
      { status: 503 },
    )
  }
  const catalogById = new Map(catalog.map((item) => [item.id, item]))
  const parsedTiers = tiers as CakeTier[]
  const parsedDesign = design as CakeDesign
  const isSelectionOfKind = (id: string, kind: ProductKind) =>
    catalogById.get(id)?.kind === kind
  const selectedBaseProduct = parsedDesign.baseProductId
    ? catalogById.get(parsedDesign.baseProductId)
    : null
  if (
    !parsedTiers.every(
      (tier) =>
        isSelectionOfKind(tier.flavourId!, 'flavour') &&
        isSelectionOfKind(tier.frostingId!, 'frosting') &&
        isSelectionOfKind(tier.fillingId!, 'filling') &&
        catalogById.get(tier.flavourId!)?.name === tier.flavour &&
        catalogById.get(tier.frostingId!)?.name === tier.frosting &&
        catalogById.get(tier.fillingId!)?.name === tier.filling,
    ) ||
    !parsedDesign.toppingIds!.every(
      (id, index) =>
        isSelectionOfKind(id, 'topping') &&
        catalogById.get(id)?.name === parsedDesign.toppings[index],
    ) ||
    (parsedDesign.baseProductId !== null &&
      (!selectedBaseProduct ||
        selectedBaseProduct.kind !== 'base_product' ||
        selectedBaseProduct.name !== parsedDesign.baseProductName ||
        selectedBaseProduct.category !== category))
  ) {
    return NextResponse.json(
      { error: 'One or more selected products are no longer available.' },
      { status: 400 },
    )
  }

  const estimate = calculateCakePrice(
    parsedTiers.map((tier) => ({
      size: tier.size,
      layers: tier.layers,
      flavourId: tier.flavourId!,
      frostingId: tier.frostingId!,
      fillingId: tier.fillingId!,
    })),
    parsedDesign.toppingIds!,
    prices,
    currency,
    parsedDesign.baseProductId,
  )
  if (estimate === null || estimate > 1000000000) {
    return NextResponse.json(
      { error: 'Cake prices are not configured for this design yet.' },
      { status: 503 },
    )
  }

  let deliveryFee: number | null = null
  let deliveryDistanceKm: number | null = null

  if (fulfillment === 'Delivery') {
    const settings = await getDeliverySettings()
    if (!settings.bakeryCoordinates) {
      return NextResponse.json(
        { error: 'The bakery has not configured a delivery origin yet.' },
        { status: 503 },
      )
    }
    const deliveryPrice = settings.deliveryPrices[currency]
    const perKmRate = settings.deliveryPerKmRates[currency]
    if (deliveryPrice === undefined || perKmRate === undefined) {
      return NextResponse.json(
        { error: `Delivery prices are not configured for ${currency}.` },
        { status: 503 },
      )
    }

    try {
      const config: DeliveryFeeConfig = {
        ...DEFAULT_DELIVERY_FEE_CONFIG,
        bakeryLat: settings.bakeryCoordinates.lat,
        bakeryLng: settings.bakeryCoordinates.lng,
        baseFee: deliveryPrice,
        perKmRate,
      }
      const quote = await calculateDeliveryFee({
        address: formatAddressForGeocoding(address, postcode),
        geocodeAddress: geocodeAddressWithNominatim,
        config,
      })

      if (!quote.deliverable) {
        return NextResponse.json(
          { error: 'Please recheck that the delivery address is eligible.' },
          { status: 422 },
        )
      }
      deliveryFee = quote.fee
      deliveryDistanceKm = quote.distanceKm
    } catch (error) {
      console.error('Cake request delivery verification failed:', error)
      return NextResponse.json(
        { error: 'Delivery checking is temporarily unavailable.' },
        { status: 503 },
      )
    }
  }

  const image =
    payload.referenceImage && isReferenceImage(payload.referenceImage)
      ? payload.referenceImage
      : null
  const total = estimate + (deliveryFee ?? 0)
  const paymentReference = randomUUID()

  try {
    assertPaystackConfiguration()
    assertCustomerEmailConfiguration()
  } catch (error) {
    console.error('Online cake payment is not configured:', error)
    return NextResponse.json(
      { error: 'Online payment is temporarily unavailable. Please contact the studio.' },
      { status: 503 },
    )
  }

  try {
    const requestId = await db.transaction(async (transaction) => {
      const [savedCustomer] = await transaction
        .insert(customers)
        .values({ name, email, phone, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: customers.email,
          set: { name, phone, updatedAt: new Date() },
        })
        .returning({ id: customers.id })

      const [savedRequest] = await transaction
        .insert(cakeRequests)
        .values({
          customerId: savedCustomer.id,
          category,
          preferredDate,
          fulfillment,
          deliveryAddress: fulfillment === 'Delivery' ? address : null,
          deliveryPostcode: fulfillment === 'Delivery' ? postcode : null,
          deliveryFee: deliveryFee?.toFixed(2) ?? null,
          deliveryDistanceKm: deliveryDistanceKm?.toFixed(2) ?? null,
          cakeEstimate: estimate.toFixed(2),
          currency,
          design,
          status: 'awaiting_payment',
          paymentStatus: 'awaiting_payment',
          paymentReference,
        })
        .returning({ id: cakeRequests.id })

      await transaction.insert(cakeRequestTiers).values(
        (tiers as CakeTier[]).map((tier, index) => ({
          requestId: savedRequest.id,
          position: index + 1,
          ...tier,
        })),
      )

      if (image) {
        await transaction.insert(cakeRequestFiles).values({
          requestId: savedRequest.id,
          dropaphiFileId: image.id as string,
          url: image.url as string,
          name: image.name as string,
          mimeType: image.mimeType as string,
          sizeBytes: Number(image.size),
        })
      }

      return savedRequest.id
    })

    try {
      const checkout = await initializePaystackTransaction({
        reference: paymentReference,
        email,
        amount: total,
        currency,
        requestId,
      })

      return NextResponse.json(
        { ok: true, authorizationUrl: checkout.authorization_url },
        { status: 201 },
      )
    } catch (error) {
      try {
        await db
          .update(cakeRequests)
          .set({
            status: 'payment_failed',
            paymentStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(cakeRequests.id, requestId))
      } catch (statusError) {
        console.error(
          `Cake request ${requestId} payment status could not be updated:`,
          statusError,
        )
      }
      console.error('Paystack checkout could not be initialized:', error)
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? `Online payment could not be started: ${error.message}`
              : 'Online payment could not be started. Please try again.',
        },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error('Cake request could not be saved:', error)
    return NextResponse.json(
      { error: 'Your request could not be saved. Please try again.' },
      { status: 500 },
    )
  }
}
