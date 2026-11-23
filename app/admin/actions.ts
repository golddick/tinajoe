'use server'

import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  adminInvitations,
  blockedDates,
  deliverySettings,
  deliveryPrices,
  galleryCategories,
  galleryItems,
  productCatalog,
  productPrices,
  studioAdmin,
  user,
} from '@/lib/db/schema'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { hashAdminInvitationToken } from '@/lib/admin-invitations'
import { renderBrandedEmail } from '@/lib/email-template'
import { sendTransactionalEmail } from '@/lib/dropaphi'
import { geocodeAddressWithNominatim } from '@/lib/nominatim-geocoder'
import {
  isCurrency,
  isProductKind,
  productKindLabel,
  type ProductKind,
  type Currency,
} from '@/lib/pricing-catalog'

export async function saveDeliveryPrices(
  entries: Array<{
    currency: string
    amount: string
    perKmAmount: string
  }>,
) {
  await requireAdmin()

  if (!Array.isArray(entries) || entries.length !== 3) {
    return { ok: false, error: 'Submit a delivery price for each supported currency.' }
  }

  const seen = new Set<string>()
  const values: Array<{
    currency: Currency
    amount: string
    perKmAmount: string
    updatedAt: Date
  }> = []
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.currency !== 'string' ||
      !isCurrency(entry.currency) ||
      seen.has(entry.currency) ||
      typeof entry.amount !== 'string' ||
      typeof entry.perKmAmount !== 'string'
    ) {
      return { ok: false, error: 'One or more delivery prices are invalid.' }
    }
    seen.add(entry.currency)
    const rawAmount = entry.amount.trim()
    const rawPerKmAmount = entry.perKmAmount.trim()
    if (!rawAmount && !rawPerKmAmount) continue
    if (!rawAmount || !rawPerKmAmount) {
      return {
        ok: false,
        error: 'Enter both the base delivery price and per-kilometre rate for each enabled market.',
      }
    }
    const amount = Number(rawAmount)
    const perKmAmount = Number(rawPerKmAmount)
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 100_000_000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7 ||
      !Number.isFinite(perKmAmount) ||
      perKmAmount < 0 ||
      perKmAmount > 100_000_000 ||
      Math.abs(perKmAmount * 100 - Math.round(perKmAmount * 100)) > 1e-7
    ) {
      return {
        ok: false,
        error: 'Delivery prices and per-kilometre rates must be between 0 and 100,000,000 with up to 2 decimal places.',
      }
    }
    values.push({
      currency: entry.currency,
      amount: amount.toFixed(2),
      perKmAmount: perKmAmount.toFixed(2),
      updatedAt: new Date(),
    })
  }
  if (seen.size !== 3) {
    return { ok: false, error: 'Submit a delivery price for each supported currency.' }
  }

  await db.transaction(async (transaction) => {
    await transaction.delete(deliveryPrices)
    if (values.length) await transaction.insert(deliveryPrices).values(values)
  })

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/api/delivery-fee')
  return { ok: true }
}

export async function blockUnavailableDate(dateInput: string) {
  await requireAdmin()
  if (!isValidCalendarDate(dateInput)) {
    return { ok: false, error: 'Choose a valid date to block.' }
  }
  const [blocked] = await db
    .insert(blockedDates)
    .values({ date: dateInput })
    .onConflictDoNothing()
    .returning({ date: blockedDates.date })
  if (!blocked) {
    return { ok: false, error: 'That date is already blocked.' }
  }
  revalidatePath('/admin')
  revalidatePath('/')
  return { ok: true, date: blocked.date }
}

export async function unblockUnavailableDate(dateInput: string) {
  await requireAdmin()
  if (!isValidCalendarDate(dateInput)) {
    return { ok: false, error: 'Choose a valid date to unblock.' }
  }
  const [unblocked] = await db
    .delete(blockedDates)
    .where(eq(blockedDates.date, dateInput))
    .returning({ date: blockedDates.date })
  if (!unblocked) {
    return { ok: false, error: 'That date is not currently blocked.' }
  }
  revalidatePath('/admin')
  revalidatePath('/')
  return { ok: true, date: unblocked.date }
}

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function getInvitationOrigin() {
  const configuredOrigin =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL) ??
    (process.env.NODE_ENV === 'development' ? 'https://tinajoe.vercel.app' : '')

  if (!configuredOrigin) {
    throw new Error('Configure BETTER_AUTH_URL before sending admin invitations.')
  }

  const url = new URL(
    configuredOrigin.startsWith('http')
      ? configuredOrigin
      : `https://${configuredOrigin}`,
  )
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The admin invitation URL must use HTTP or HTTPS.')
  }
  return url.origin
}

export async function createAdminInvitation(input: {
  name: string
  email: string
}): Promise<{
  ok: boolean
  error?: string
  invitation?: {
    id: string
    name: string
    email: string
    expiresAt: string
  }
}> {
  const adminSession = await requireAdmin()
  if (
    !input ||
    typeof input.name !== 'string' ||
    typeof input.email !== 'string'
  ) {
    return { ok: false, error: 'Enter the team member’s name and email.' }
  }

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name || name.length > 120) {
    return { ok: false, error: 'Names must be between 1 and 120 characters.' }
  }
  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  if (existingUser) {
    const [existingAdmin] = await db
      .select({ id: studioAdmin.id })
      .from(studioAdmin)
      .where(eq(studioAdmin.userId, existingUser.id))
      .limit(1)
    return {
      ok: false,
      error: existingAdmin
        ? 'This person is already a studio administrator.'
        : 'An account already uses this email address.',
    }
  }

  const [existingInvitation] = await db
    .select({
      id: adminInvitations.id,
      acceptedAt: adminInvitations.acceptedAt,
    })
    .from(adminInvitations)
    .where(eq(adminInvitations.email, email))
    .limit(1)
  if (existingInvitation?.acceptedAt) {
    return {
      ok: false,
      error: 'This invitation has already been accepted by an admin.',
    }
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const invitationUrl = new URL('/admin/accept-invite', getInvitationOrigin())
  invitationUrl.searchParams.set('token', token)
  const createdAt = new Date()

  const [invitation] = existingInvitation
    ? await db
        .update(adminInvitations)
        .set({
          name,
          tokenHash: hashAdminInvitationToken(token),
          expiresAt,
          createdAt,
          createdByUserId: adminSession.user.id,
          acceptedAt: null,
          acceptedUserId: null,
        })
        .where(eq(adminInvitations.id, existingInvitation.id))
        .returning({
          id: adminInvitations.id,
          name: adminInvitations.name,
          email: adminInvitations.email,
          expiresAt: adminInvitations.expiresAt,
        })
    : await db
        .insert(adminInvitations)
        .values({
          name,
          email,
          tokenHash: hashAdminInvitationToken(token),
          expiresAt,
          createdByUserId: adminSession.user.id,
        })
        .returning({
          id: adminInvitations.id,
          name: adminInvitations.name,
          email: adminInvitations.email,
          expiresAt: adminInvitations.expiresAt,
        })

  if (!invitation) {
    throw new Error('The admin invitation could not be saved.')
  }

  const content = {
    preheader: 'You have been invited to join the studio admin team.',
    title: 'TINA.JOE Studio administrator invitation',
    greeting: `Hello ${name},`,
    paragraphs: [
      'The studio administrator invited you to help manage the bakery workspace. Your account will have administrator access.',
      'Use the secure link below within seven days to confirm your name and email and create a password.',
    ],
    details: [{ label: 'Invited email', value: email }],
    button: { label: 'Accept invitation', url: invitationUrl.toString() },
  }
  const { html, text } = renderBrandedEmail(content)
  try {
    await sendTransactionalEmail({
      to: email,
      subject: 'You are invited to the TINA.JOE studio admin team',
      html,
      text,
      fromName: 'TINA.JOE',
    })
  } catch (error) {
    console.error('Admin invitation email could not be sent:', error)
    revalidatePath('/admin')
    return {
      ok: false,
      invitation: {
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      error:
        'The invitation was saved, but the email could not be sent. Check the email service and send the invitation again.',
    }
  }

  revalidatePath('/admin')
  return {
    ok: true,
    invitation: {
      ...invitation,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  }
}

export async function revokeAdminInvitation(invitationIdInput: string) {
  await requireAdmin()
  if (
    typeof invitationIdInput !== 'string' ||
    !invitationIdInput.trim() ||
    invitationIdInput.length > 200
  ) {
    return { ok: false, error: 'Choose a valid invitation.' }
  }

  const [revoked] = await db
    .delete(adminInvitations)
    .where(
      and(
        eq(adminInvitations.id, invitationIdInput.trim()),
        isNull(adminInvitations.acceptedAt),
      ),
    )
    .returning({ id: adminInvitations.id })
  if (!revoked) {
    return {
      ok: false,
      error: 'This invitation is no longer pending.',
    }
  }

  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteProductCategory(categoryInput: string) {
  await requireAdmin()

  if (
    typeof categoryInput !== 'string' ||
    !categoryInput.trim() ||
    categoryInput.trim().length > 60
  ) {
    return { ok: false, error: 'Choose a valid product category.' }
  }
  const category = categoryInput.trim()
  const deleted = await db
    .update(productCatalog)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(productCatalog.category, category), eq(productCatalog.active, true)))
    .returning({ id: productCatalog.id })

  if (!deleted.length) {
    return { ok: false, error: 'This category is no longer available.' }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return {
    ok: true,
    removedIds: deleted.map((item) => item.id),
    message: `${category} was deactivated on the storefront.`,
  }
}

export async function deleteProductCatalogItem(productIdInput: string) {
  await requireAdmin()

  if (
    typeof productIdInput !== 'string' ||
    !productIdInput.trim() ||
    productIdInput.trim().length > 200
  ) {
    return { ok: false, error: 'Choose a valid product.' }
  }

  const [removed] = await db
    .update(productCatalog)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(productCatalog.id, productIdInput.trim()),
        eq(productCatalog.active, true),
      ),
    )
    .returning({
      id: productCatalog.id,
      name: productCatalog.name,
    })

  if (!removed) {
    return { ok: false, error: 'This product is no longer available.' }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return {
    ok: true,
    removedId: removed.id,
    message: `${removed.name} was removed from the storefront. Existing orders and saved prices were kept.`,
  }
}

export async function createGalleryCategory(nameInput: string) {
  await requireAdmin()

  if (typeof nameInput !== 'string') {
    return { ok: false, error: 'Enter a category name.' }
  }
  const name = nameInput.trim()
  if (!name || name.length > 60) {
    return {
      ok: false,
      error: 'Category names must be between 1 and 60 characters.',
    }
  }

  const existingCategories = await db
    .select({ name: galleryCategories.name })
    .from(galleryCategories)
    .where(eq(galleryCategories.active, true))
  if (
    existingCategories.some(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { ok: false, error: 'That gallery category already exists.' }
  }

  const [category] = await db
    .insert(galleryCategories)
    .values({ name, updatedAt: new Date() })
    .returning({
      id: galleryCategories.id,
      name: galleryCategories.name,
    })

  revalidatePath('/admin')
  return { ok: true, category }
}

export async function saveGalleryItem(input: {
  id?: string
  title: string
  categoryId: string
  imageId: string
  imageUrl: string
}) {
  await requireAdmin()

  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.title !== 'string' ||
    typeof input.categoryId !== 'string' ||
    typeof input.imageId !== 'string' ||
    typeof input.imageUrl !== 'string' ||
    (input.id !== undefined && typeof input.id !== 'string')
  ) {
    return { ok: false, error: 'Enter a title, category, and uploaded image.' }
  }

  const title = input.title.trim()
  const imageId = input.imageId.trim()
  if (!title || title.length > 100 || !imageId || imageId.length > 255) {
    return {
      ok: false,
      error: 'Titles must be 1–100 characters and the uploaded image must be valid.',
    }
  }

  let imageUrl: URL
  try {
    imageUrl = new URL(input.imageUrl)
  } catch {
    return { ok: false, error: 'Choose a valid uploaded gallery image.' }
  }
  if (
    imageUrl.protocol !== 'https:' ||
    (imageUrl.hostname !== 'dropaphi.xyz' &&
      !imageUrl.hostname.endsWith('.dropaphi.xyz'))
  ) {
    return { ok: false, error: 'Choose a public image uploaded to the gallery.' }
  }

  const [category] = await db
    .select({ id: galleryCategories.id, name: galleryCategories.name })
    .from(galleryCategories)
    .where(
      and(
        eq(galleryCategories.id, input.categoryId),
        eq(galleryCategories.active, true),
      ),
    )
    .limit(1)
  if (!category) {
    return { ok: false, error: 'Choose an available gallery category.' }
  }

  const values = {
    categoryId: category.id,
    title,
    imageId,
    imageUrl: imageUrl.toString(),
    updatedAt: new Date(),
  }
  const [item] = input.id
    ? await db
        .update(galleryItems)
        .set(values)
        .where(
          and(
            eq(galleryItems.id, input.id),
            eq(galleryItems.active, true),
          ),
        )
        .returning({
          id: galleryItems.id,
          title: galleryItems.title,
          categoryId: galleryItems.categoryId,
          imageId: galleryItems.imageId,
          image: galleryItems.imageUrl,
        })
    : await db
        .insert(galleryItems)
        .values(values)
        .returning({
          id: galleryItems.id,
          title: galleryItems.title,
          categoryId: galleryItems.categoryId,
          imageId: galleryItems.imageId,
          image: galleryItems.imageUrl,
        })

  if (!item) {
    return { ok: false, error: 'This gallery item is no longer available.' }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return {
    ok: true,
    item: { ...item, category: category.name },
  }
}

export async function deleteGalleryItem(itemId: string) {
  await requireAdmin()

  if (typeof itemId !== 'string' || !itemId.trim() || itemId.length > 200) {
    return { ok: false, error: 'Choose a valid gallery item.' }
  }

  const [removed] = await db
    .update(galleryItems)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(eq(galleryItems.id, itemId.trim()), eq(galleryItems.active, true)),
    )
    .returning({ id: galleryItems.id })
  if (!removed) {
    return { ok: false, error: 'This gallery item is no longer available.' }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { ok: true, removedId: removed.id }
}

export async function saveProductPrices(
  currencyInput: string,
  entries: Array<{ productId: string; amount: string }>,
) {
  await requireAdmin()
  const activeProducts = await db
    .select({ id: productCatalog.id })
    .from(productCatalog)
    .where(eq(productCatalog.active, true))
  const productIds = activeProducts.map((product) => product.id)

  if (
    !isCurrency(currencyInput) ||
    !Array.isArray(entries) ||
    entries.length !== productIds.length
  ) {
    return { ok: false, error: 'Submit every product price for a supported currency.' }
  }

  const allowedProductIds = new Set(productIds)
  const seen = new Set<string>()
  const values: Array<{
    productId: string
    currency: Currency
    amount: string
    updatedAt: Date
  }> = []

  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.productId !== 'string' ||
      !allowedProductIds.has(entry.productId) ||
      seen.has(entry.productId) ||
      typeof entry.amount !== 'string'
    ) {
      return { ok: false, error: 'One or more product prices are invalid.' }
    }
    seen.add(entry.productId)

    const rawAmount = entry.amount.trim()
    if (!rawAmount) continue
    const amount = Number(rawAmount)
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1_000_000_000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7
    ) {
      return {
        ok: false,
        error: 'Prices must be between 0 and 1,000,000,000 with up to 2 decimal places.',
      }
    }
    values.push({
      productId: entry.productId,
      currency: currencyInput,
      amount: amount.toFixed(2),
      updatedAt: new Date(),
    })
  }

  if (seen.size !== productIds.length) {
    return { ok: false, error: 'Submit every product price for this currency.' }
  }

  await db.transaction(async (transaction) => {
    await transaction
      .delete(productPrices)
      .where(eq(productPrices.currency, currencyInput))
    if (values.length > 0) {
      await transaction.insert(productPrices).values(values)
    }
  })

  revalidatePath('/')
  revalidatePath('/admin')
  return {
    ok: true,
    message: values.length === productIds.length
      ? `${currencyInput} prices saved for all products.`
      : `${currencyInput} prices saved. Blank prices remain unavailable.`,
  }
}

export async function addProductCatalogItem(input: {
  name: string
  kind: string
  currency: string
  amount: string
}) {
  await requireAdmin()

  if (
    !input ||
    typeof input.name !== 'string' ||
    typeof input.kind !== 'string' ||
    typeof input.currency !== 'string' ||
    typeof input.amount !== 'string'
  ) {
    return { ok: false, error: 'Enter a product name, category, currency, and price.' }
  }

  const name = input.name.trim()
  const amountText = input.amount.trim()
  if (!name || name.length > 100) {
    return { ok: false, error: 'Product names must be between 1 and 100 characters.' }
  }
  if (
    !isProductKind(input.kind) ||
    !isCurrency(input.currency)
  ) {
    return { ok: false, error: 'Choose a supported product category and currency.' }
  }
  const amount = Number(amountText)
  if (
    !amountText ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 1_000_000_000 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7
  ) {
    return { ok: false, error: 'Enter a price from 0 to 1,000,000,000 with up to 2 decimals.' }
  }

  const id = `custom_${randomUUID().replace(/-/g, '')}`
  const kind: ProductKind = input.kind
  const category = productKindLabel(kind)
  const [created] = await db.transaction(async (transaction) => {
    const [item] = await transaction
      .insert(productCatalog)
      .values({
        id,
        name,
        category,
        kind,
        sortOrder: 1000,
        updatedAt: new Date(),
      })
      .returning({
        id: productCatalog.id,
        name: productCatalog.name,
        category: productCatalog.category,
        kind: productCatalog.kind,
      })
    await transaction.insert(productPrices).values({
      productId: id,
      currency: input.currency,
      amount: amount.toFixed(2),
      updatedAt: new Date(),
    })
    return [item]
  })

  revalidatePath('/')
  revalidatePath('/admin')
  return {
    ok: true,
    item: { ...created, kind: kind as ProductKind },
    amount,
    currency: input.currency as Currency,
    message: `${name} was added in ${category}. Add prices in other currencies separately.`,
  }
}

export async function updateStudioSettings(input: {
  email: string
  phone: string
  bakeryAddress: string
  bakeryCoordinates?: { lat: number; lng: number } | null
}) {
  await requireAdmin()

  if (
    !input ||
    typeof input.email !== 'string' ||
    typeof input.phone !== 'string' ||
    typeof input.bakeryAddress !== 'string'
  ) {
    return { ok: false, error: 'Enter valid studio contact and address details.' }
  }

  const email = input.email.trim().toLowerCase()
  const phone = input.phone.trim()
  const rawAddress = input.bakeryAddress
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return { ok: false, error: 'Enter a valid studio email address.' }
  }
  if (phone.length < 7 || phone.length > 40) {
    return { ok: false, error: 'Enter a phone number between 7 and 40 characters.' }
  }
  if (rawAddress.trim().length > 500) {
    return { ok: false, error: 'Enter a bakery address of 500 characters or fewer.' }
  }

  const address = rawAddress.trim().replace(/\s+/g, ' ')
  let coordinates: { lat: number; lng: number } | null = null
  if (address) {
    const selectedCoordinates = input.bakeryCoordinates
    if (selectedCoordinates !== undefined && selectedCoordinates !== null) {
      if (
        typeof selectedCoordinates !== 'object' ||
        !Number.isFinite(selectedCoordinates.lat) ||
        selectedCoordinates.lat < -90 ||
        selectedCoordinates.lat > 90 ||
        !Number.isFinite(selectedCoordinates.lng) ||
        selectedCoordinates.lng < -180 ||
        selectedCoordinates.lng > 180
      ) {
        return {
          ok: false,
          error: 'Select a valid bakery location on the map or search again.',
        }
      }

      coordinates = selectedCoordinates
    } else {
      try {
        coordinates = await geocodeAddressWithNominatim(address)
      } catch {
        return {
          ok: false,
          error: 'The bakery address could not be checked. Please try again.',
        }
      }
      if (!coordinates) {
        return {
          ok: false,
          error: 'No matching location was found. Add more address details.',
        }
      }
    }
  }

  const settings = await getDeliverySettings()
  const updatedAt = new Date()
  await db
    .insert(deliverySettings)
    .values({
      id: 'global',
      flatFee: settings.flatFee.toFixed(2),
      studioEmail: email,
      studioPhone: phone,
      bakeryAddress: address || null,
      bakeryLatitude: coordinates?.lat.toFixed(7) ?? null,
      bakeryLongitude: coordinates?.lng.toFixed(7) ?? null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: deliverySettings.id,
      set: {
        studioEmail: email,
        studioPhone: phone,
        bakeryAddress: address || null,
        bakeryLatitude: coordinates?.lat.toFixed(7) ?? null,
        bakeryLongitude: coordinates?.lng.toFixed(7) ?? null,
        updatedAt,
      },
    })

  revalidatePath('/admin')
  revalidatePath('/api/delivery-fee')
  revalidatePath('/')
  return {
    ok: true,
    message: address
      ? 'Studio settings saved. The bakery address is ready for delivery checks.'
      : 'Studio settings saved. Delivery checks are disabled until a bakery address is saved.',
  }
}
