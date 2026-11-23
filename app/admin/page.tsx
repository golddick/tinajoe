import { desc, eq, inArray, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import StudioDashboard from '@/components/studio-dashboard'
import { getAdminSession } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  adminInvitations,
  blockedDates,
  cakeRequestFiles,
  cakeRequests,
  cakeRequestTiers,
  customers,
  studioAdmin,
  user,
} from '@/lib/db/schema'
import { getDeliverySettings } from '@/lib/delivery-settings'
import { MAX_RADIUS_KM } from '@/lib/delivery-fee-config'
import { getGalleryContent } from '@/lib/gallery'
import { getProductPriceCatalog } from '@/lib/product-prices'

export const metadata = {
  title: 'Studio dashboard — Tina.Joe.studio',
  description: 'Manage cake requests, pricing and studio availability.',
}

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/sign-in')

  const [
    deliverySettings,
    requestRows,
    pricingCatalog,
    galleryContent,
    blockedDateRows,
    teamMemberRows,
    invitationRows,
  ] =
    await Promise.all([
      getDeliverySettings(),
      db
        .select({ request: cakeRequests, customer: customers })
        .from(cakeRequests)
        .innerJoin(customers, eq(cakeRequests.customerId, customers.id))
        .orderBy(desc(cakeRequests.createdAt))
        .limit(100),
      getProductPriceCatalog(),
      getGalleryContent(),
      db
        .select({ date: blockedDates.date })
        .from(blockedDates)
        .orderBy(blockedDates.date),
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
        })
        .from(studioAdmin)
        .innerJoin(user, eq(studioAdmin.userId, user.id))
        .orderBy(user.name),
      db
        .select({
          id: adminInvitations.id,
          name: adminInvitations.name,
          email: adminInvitations.email,
          expiresAt: adminInvitations.expiresAt,
        })
        .from(adminInvitations)
        .where(isNull(adminInvitations.acceptedAt))
        .orderBy(desc(adminInvitations.createdAt)),
    ])
  const requestIds = requestRows.map(({ request }) => request.id)
  const tiers = requestIds.length
    ? await db
        .select()
        .from(cakeRequestTiers)
        .where(inArray(cakeRequestTiers.requestId, requestIds))
        .orderBy(cakeRequestTiers.position)
    : []
  const requestFiles = requestIds.length
    ? await db
        .select()
        .from(cakeRequestFiles)
        .where(inArray(cakeRequestFiles.requestId, requestIds))
        .orderBy(cakeRequestFiles.createdAt)
    : []
  const filesByRequest = new Map<string, (typeof requestFiles)[number]>()
  for (const file of requestFiles) {
    if (!filesByRequest.has(file.requestId)) {
      filesByRequest.set(file.requestId, file)
    }
  }
  const tiersByRequest = new Map<string, typeof tiers>()
  for (const tier of tiers) {
    const requestTiers = tiersByRequest.get(tier.requestId) ?? []
    requestTiers.push(tier)
    tiersByRequest.set(tier.requestId, requestTiers)
  }

  const initialOrders = requestRows.map(({ request, customer }) => {
    const design = request.design
    const referenceImage = filesByRequest.get(request.id)
    const requestTierDetails = (tiersByRequest.get(request.id) ?? []).map(
      (tier) => ({
        position: tier.position,
        size: tier.size,
        layers: tier.layers,
        flavour: tier.flavour,
        frosting: tier.frosting,
        filling: tier.filling,
      }),
    )
    const finish = `${design.colour}${design.ombre ? ` + ${design.secondColour} ombré` : ''} · ${design.design}`
    const statusLabels: Record<string, string> = {
      awaiting_payment: 'Awaiting payment',
      payment_failed: 'Payment failed',
      new_request: 'New request',
      approval_pending: 'Approval email pending',
      refund_pending: 'Refund pending',
      rejected: 'Rejected',
      confirmed: 'Confirmed',
      in_progress: 'In progress',
    }
    const paymentStatusLabels: Record<string, string> = {
      awaiting_payment: 'Awaiting payment',
      failed: 'Payment failed',
      paid: 'Paid',
      refund_pending: 'Refund pending',
      refunded: 'Refunded',
      refund_failed: 'Refund failed',
      not_sent: 'Not paid',
    }

    return {
      id: request.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      type: request.category,
      date: new Date(`${request.preferredDate}T00:00:00`).toLocaleDateString(
        'en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' },
      ),
      estimate: Number(request.cakeEstimate),
      currency: request.currency || 'GBP',
      status: statusLabels[request.status] ?? request.status,
      details: [design.baseProductName, finish].filter(Boolean).join(' · '),
      tiers: requestTierDetails,
      toppings: design.toppings.join(' · '),
      note: design.notes,
      approvalNote: request.approvalNote ?? '',
      rejectionNote: request.rejectionNote ?? '',
      fulfillment: request.fulfillment as 'Collection' | 'Delivery',
      address: request.deliveryAddress ?? deliverySettings.bakeryAddress,
      postcode: request.deliveryPostcode ?? '',
      deliveryFee:
        request.deliveryFee === null ? null : Number(request.deliveryFee),
      referenceImage: referenceImage
        ? { url: referenceImage.url, name: referenceImage.name }
        : null,
      payment: paymentStatusLabels[request.paymentStatus] ?? request.paymentStatus,
    }
  })

  const adminName =
    session.user.name?.trim() ||
    session.user.email.split('@')[0]?.replace(/^./, (letter) =>
      letter.toUpperCase(),
    ) ||
    'Admin'

  return (
    <StudioDashboard
      adminName={adminName}
      initialDeliveryPrices={deliverySettings.deliveryPrices}
      initialDeliveryPerKmRates={deliverySettings.deliveryPerKmRates}
      initialMaxDeliveryKm={MAX_RADIUS_KM}
      initialStudioEmail={deliverySettings.studioEmail}
      initialStudioPhone={deliverySettings.studioPhone}
      initialBakeryAddress={deliverySettings.bakeryAddress}
      initialBakeryCoordinates={deliverySettings.bakeryCoordinates}
      initialProductPrices={pricingCatalog.prices}
      initialProductCatalog={pricingCatalog.catalog}
      initialOrders={initialOrders}
      initialGalleryCategories={galleryContent.categories}
      initialGalleryItems={galleryContent.items}
      initialBlockedDates={blockedDateRows.map(({ date }) => date)}
      initialTeamMembers={teamMemberRows}
      initialAdminInvitations={invitationRows.map((invitation) => ({
        ...invitation,
        expiresAt: invitation.expiresAt.toISOString(),
      }))}
    />
  )
}
