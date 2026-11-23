'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import type { AddressSuggestion } from '@/lib/address-suggestions'
import { AdminGreeting } from '@/components/admin-greeting'
import {
  addProductCatalogItem,
  blockUnavailableDate,
  createAdminInvitation,
  createGalleryCategory,
  deleteGalleryItem,
  deleteProductCategory,
  deleteProductCatalogItem,
  saveGalleryItem as saveGalleryItemAction,
  saveDeliveryPrices,
  saveProductPrices,
  updateStudioSettings,
  unblockUnavailableDate,
  revokeAdminInvitation,
} from '@/app/admin/actions'
import {
  PRODUCT_KINDS,
  SUPPORTED_CURRENCIES,
  type Currency,
  type CurrencyPriceMap,
  type ProductCatalogItem,
  type ProductKind,
  formatCurrency,
  isCurrency,
  isProductKind,
  productKindLabel,
} from '@/lib/pricing-catalog'
import { AdminSignOutButton } from '@/components/admin-sign-out-button'
import {
  Check,
  CircleDollarSign,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Eye,
  Info,
  ImagePlus,
  LayoutDashboard,
  Mail,
  Save,
  Settings2,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

type Order = {
  id: string
  name: string
  email: string
  phone: string
  type: string
  date: string
  estimate: number
  currency: string
  status: string
  details: string
  tiers: OrderTier[]
  toppings: string
  note: string
  approvalNote: string
  rejectionNote: string
  fulfillment: 'Collection' | 'Delivery'
  address: string
  postcode: string
  deliveryFee: number | null
  referenceImage: { url: string; name: string } | null
  payment: string
}

type OrderTier = {
  position: number
  size: number
  layers: number
  flavour: string
  frosting: string
  filling: string
}

type GalleryCategory = { id: string; name: string }
type GalleryItem = {
  id: string
  title: string
  categoryId: string
  category: string
  imageId: string
  image: string
}
type AdminTeamMember = { id: string; name: string; email: string }
type AdminInvitation = {
  id: string
  name: string
  email: string
  expiresAt: string
}
const defaultApprovalNote =
  'Your cake order is approved. We look forward to making it for you.'
const defaultRefundNote =
  'We are unable to accept this order. A full refund to your original payment method has been requested.'

const orderStatusLabels: Record<string, string> = {
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
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'GBP') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 2,
    }).format(amount)
  }
  if (
    currency === 'NGN' ||
    currency === 'EUR' ||
    currency === 'USD'
  ) {
    return formatCurrency(amount, currency)
  }
  return `${currency} ${amount.toFixed(2)}`
}

function formatOrderPrice(order: Pick<Order, 'estimate' | 'currency'>) {
  return formatAmount(order.estimate, order.currency)
}

function OrderTierDetails({
  tiers,
  compact = false,
}: {
  tiers: OrderTier[]
  compact?: boolean
}) {
  if (!tiers.length) return null

  if (compact) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {tiers.length > 1 ? `${tiers.length} tiers · ` : ''}
        {tiers.map((tier) => `Tier ${tier.position}: ${tier.size} inch`).join(' · ')}
      </p>
    )
  }

  return (
    <ol className="mt-3 grid gap-2 sm:grid-cols-2">
      {tiers.map((tier) => (
        <li
          key={tier.position}
          className="rounded-lg border border-border bg-card/70 p-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tier {tier.position}
          </p>
          <p className="mt-1 text-sm font-medium">
            {tier.size} inch · {tier.layers} layers
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {tier.flavour} · {tier.filling} · {tier.frosting}
          </p>
        </li>
      ))}
    </ol>
  )
}

function InspirationImageDialog({
  image,
  onClose,
}: {
  image: NonNullable<Order['referenceImage']>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspiration-photo-title"
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h3 id="inspiration-photo-title" className="font-serif text-xl">
              Inspiration photo
            </h3>
            <p className="truncate text-sm text-muted-foreground">{image.name}</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close inspiration photo"
            className="rounded-full border border-border p-2 hover:bg-secondary"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="grid max-h-[80vh] min-h-48 place-items-center bg-black/5 p-3">
          <img
            src={image.url}
            alt={`Customer inspiration photo: ${image.name}`}
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />
        </div>
      </section>
    </div>
  )
}

export default function StudioDashboard({
  adminName,
  initialDeliveryPrices,
  initialDeliveryPerKmRates,
  initialMaxDeliveryKm,
  initialStudioEmail,
  initialStudioPhone,
  initialBakeryAddress,
  initialBakeryCoordinates,
  initialProductPrices,
  initialProductCatalog,
  initialOrders,
  initialGalleryCategories,
  initialGalleryItems,
  initialBlockedDates,
  initialTeamMembers,
  initialAdminInvitations,
}: {
  adminName: string
  initialDeliveryPrices: Partial<Record<Currency, number>>
  initialDeliveryPerKmRates: Partial<Record<Currency, number>>
  initialMaxDeliveryKm: number
  initialStudioEmail: string
  initialStudioPhone: string
  initialBakeryAddress: string
  initialBakeryCoordinates: { lat: number; lng: number } | null
  initialProductPrices: CurrencyPriceMap
  initialProductCatalog: ProductCatalogItem[]
  initialOrders: Order[]
  initialGalleryCategories: GalleryCategory[]
  initialGalleryItems: GalleryItem[]
  initialBlockedDates: string[]
  initialTeamMembers: AdminTeamMember[]
  initialAdminInvitations: AdminInvitation[]
}) {
  const router = useRouter()
  const [active, setActive] = useState<
    | 'overview'
    | 'requests'
    | 'confirmations'
    | 'gallery'
    | 'pricing'
    | 'calendar'
    | 'settings'
  >('overview')
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState(
    initialOrders.find(
      (order) => !['Confirmed', 'In progress'].includes(order.status),
    )?.id ?? '',
  )
  const [approvalNote, setApprovalNote] = useState(defaultApprovalNote)
  const [rejectionNote, setRejectionNote] = useState(defaultRefundNote)
  const [requestAction, setRequestAction] = useState<
    'approve' | 'reject' | 'retry_refund' | 'resend_refund_email' | null
  >(null)
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [galleryItems, setGalleryItems] = useState(initialGalleryItems)
  const [galleryCategories, setGalleryCategories] = useState(
    initialGalleryCategories,
  )
  const [editingGallery, setEditingGallery] = useState<string | null>(null)
  const [isCreatingGalleryItem, setIsCreatingGalleryItem] = useState(false)
  const [openGalleryCategoryId, setOpenGalleryCategoryId] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftCategoryId, setDraftCategoryId] = useState('')
  const [draftImage, setDraftImage] = useState('')
  const [draftImageId, setDraftImageId] = useState('')
  const [newGalleryCategoryName, setNewGalleryCategoryName] = useState('')
  const [galleryMessage, setGalleryMessage] = useState('')
  const [isCreatingGalleryCategory, setIsCreatingGalleryCategory] =
    useState(false)
  const [isUploadingGalleryImage, setIsUploadingGalleryImage] = useState(false)
  const [isSavingGalleryItem, setIsSavingGalleryItem] = useState(false)
  const [deletingGalleryItem, setDeletingGalleryItem] = useState('')
  const [studioEmail, setStudioEmail] = useState(initialStudioEmail)
  const [studioPhone, setStudioPhone] = useState(initialStudioPhone)
  const [pickupAddress, setPickupAddress] = useState(initialBakeryAddress)
  const [pickupCoordinates, setPickupCoordinates] = useState(
    initialBakeryCoordinates,
  )
  const requestOrders = orders.filter(
    (order) => !['Confirmed', 'In progress'].includes(order.status),
  )
  const selected =
    requestOrders.find((order) => order.id === selectedId) ?? requestOrders[0]
  const nav = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    {
      id: 'requests' as const,
      label: 'Cake requests',
      icon: FileText,
      count: orders.filter((order) => order.status === 'New request').length,
    },
    { id: 'confirmations' as const, label: 'Cake confirmations', icon: Check },
    { id: 'gallery' as const, label: 'Gallery', icon: ImagePlus },
    { id: 'pricing' as const, label: 'Price settings', icon: CircleDollarSign },
    { id: 'calendar' as const, label: 'Availability', icon: Settings2 },
    { id: 'settings' as const, label: 'Studio settings', icon: Settings2 },
  ]

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  useEffect(() => {
    if (!requestOrders.some((order) => order.id === selectedId)) {
      setSelectedId(requestOrders[0]?.id ?? '')
    }
  }, [requestOrders, selectedId])

  useEffect(() => {
    if (!selected) return
    setApprovalNote(selected.approvalNote || defaultApprovalNote)
    setRejectionNote(selected.rejectionNote || defaultRefundNote)
  }, [selected])

  useEffect(() => {
    if (active !== 'requests' && active !== 'confirmations') return
    const interval = window.setInterval(() => router.refresh(), 15000)
    return () => window.clearInterval(interval)
  }, [active, router])

  const updateRequest = async (
    action: 'approve' | 'reject' | 'retry_refund' | 'resend_refund_email',
  ) => {
    if (!selected) return
    const confirmation =
      action === 'reject'
        ? 'Reject this paid order and request a full refund to the original payment method?'
        : action === 'retry_refund'
          ? 'Only continue if Paystack confirms no refund request is active for this order. Retry the full refund now?'
          : null
    if (confirmation && !window.confirm(confirmation)) {
      return
    }

    setRequestAction(action)
    setRequestError('')
    setRequestMessage('')
    try {
      const response = await fetch(
        `/api/admin/cake-requests/${encodeURIComponent(selected.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            ...(action === 'approve' ? { note: approvalNote } : {}),
            ...(action === 'reject' ? { note: rejectionNote } : {}),
          }),
        },
      )
      const result = (await response.json()) as {
        error?: string
        status?: string
        paymentStatus?: string
        approvalNote?: string
        rejectionNote?: string
      }

      if (!response.ok) {
        if (result.status) {
          setOrders((current) =>
            current.map((order) =>
              order.id === selected.id
                ? {
                    ...order,
                    status: orderStatusLabels[result.status!] ?? result.status!,
                    payment:
                      paymentStatusLabels[result.paymentStatus ?? ''] ??
                      order.payment,
                  }
                : order,
            ),
          )
        }
        throw new Error(result.error || 'The order could not be updated.')
      }

      if (result.status && result.paymentStatus) {
        setOrders((current) =>
          current.map((order) =>
            order.id === selected.id
              ? {
                  ...order,
                  status: orderStatusLabels[result.status!] ?? result.status!,
                  payment:
                    paymentStatusLabels[result.paymentStatus!] ??
                    result.paymentStatus!,
                  approvalNote: result.approvalNote ?? order.approvalNote,
                  rejectionNote: result.rejectionNote ?? order.rejectionNote,
                }
              : order,
          ),
        )
      }
      setRequestMessage(
        action === 'approve'
          ? ''
          : action === 'reject'
            ? 'The refund request and customer email have been submitted.'
            : action === 'retry_refund'
              ? 'The refund retry and customer email have been submitted.'
              : 'Refund email sent.',
      )
      router.refresh()
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'The order could not be updated.',
      )
      router.refresh()
    } finally {
      setRequestAction(null)
    }
  }
  const beginUpload = (categoryId?: string) => {
    if (galleryCategories.length === 0) {
      setGalleryMessage('Create a gallery category before uploading an image.')
      return
    }
    setEditingGallery(null)
    setIsCreatingGalleryItem(true)
    setDraftTitle('')
    setDraftCategoryId(categoryId ?? '')
    setDraftImage('')
    setDraftImageId('')
    if (categoryId) setOpenGalleryCategoryId(categoryId)
    setGalleryMessage('')
  }
  const saveGalleryItem = async () => {
    if (!draftImage || !draftImageId) {
      setGalleryMessage('Choose an image and wait for its upload to finish.')
      return
    }
    if (!draftCategoryId || !draftTitle.trim()) {
      setGalleryMessage('Enter a title and select a category.')
      return
    }

    setIsSavingGalleryItem(true)
    setGalleryMessage('')
    try {
      const result = await saveGalleryItemAction({
        id: editingGallery ?? undefined,
        title: draftTitle,
        categoryId: draftCategoryId,
        imageId: draftImageId,
        imageUrl: draftImage,
      })
      if (!result.ok || !result.item) {
        setGalleryMessage(result.error ?? 'Could not save this gallery item.')
        return
      }

      const savedItem = result.item
      setGalleryItems((current) => [
        savedItem,
        ...current.filter((item) => item.id !== savedItem.id),
      ])
      setOpenGalleryCategoryId(savedItem.categoryId)
      setEditingGallery(null)
      setIsCreatingGalleryItem(false)
      setDraftTitle('')
      setDraftCategoryId('')
      setDraftImage('')
      setDraftImageId('')
      setGalleryMessage('Gallery item saved and published.')
    } catch {
      setGalleryMessage('Could not save this gallery item. Please try again.')
    } finally {
      setIsSavingGalleryItem(false)
    }
  }
  const editGalleryItem = (id: string) => {
    const item = galleryItems.find((galleryItem) => galleryItem.id === id)
    if (!item) return
    setEditingGallery(item.id)
    setIsCreatingGalleryItem(false)
    setDraftTitle(item.title)
    setDraftCategoryId(item.categoryId)
    setDraftImage(item.image)
    setDraftImageId(item.imageId)
    setGalleryMessage('')
  }
  const selectGalleryCategory = (categoryId: string) => {
    setDraftCategoryId(categoryId)
    if (editingGallery) {
      const currentItem = galleryItems.find(
        (item) => item.id === editingGallery,
      )
      if (currentItem && currentItem.categoryId !== categoryId) {
        setDraftImage('')
        setDraftImageId('')
        setGalleryMessage(
          'Upload the image again to place it in the new DropAPHI category folder.',
        )
      }
    }
  }
  const cancelGalleryEdit = () => {
    setEditingGallery(null)
    setIsCreatingGalleryItem(false)
    setDraftTitle('')
    setDraftCategoryId('')
    setDraftImage('')
    setDraftImageId('')
    setGalleryMessage('')
  }
  const createGalleryCategoryHandler = async () => {
    setIsCreatingGalleryCategory(true)
    setGalleryMessage('')
    try {
      const result = await createGalleryCategory(newGalleryCategoryName)
      if (!result.ok || !result.category) {
        setGalleryMessage(result.error ?? 'Could not create this category.')
        return
      }
      const category = result.category
      setGalleryCategories((current) => [...current, category])
      setNewGalleryCategoryName('')
      setGalleryMessage(`${category.name} category created.`)
    } catch {
      setGalleryMessage('Could not create this category. Please try again.')
    } finally {
      setIsCreatingGalleryCategory(false)
    }
  }
  const uploadGalleryImageFile = async (file?: File) => {
    if (!file) return
    if (!draftCategoryId) {
      setGalleryMessage('Select a category before uploading an image.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setGalleryMessage('Choose a JPG, PNG, or WebP image up to 2 MB.')
      return
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setGalleryMessage('Choose a JPG, PNG, or WebP image up to 2 MB.')
      return
    }

    setIsUploadingGalleryImage(true)
    setGalleryMessage('')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(
          ...bytes.subarray(offset, offset + 0x8000),
        )
      }
      const response = await fetch('/api/admin/gallery/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          data: btoa(binary),
          categoryId: draftCategoryId,
        }),
      })
      const result = (await response.json()) as {
        error?: string
        file?: { id: string; url: string; name: string }
      }
      if (!response.ok || !result.file) {
        throw new Error(result.error ?? 'The image could not be uploaded.')
      }

      setDraftImage(result.file.url)
      setDraftImageId(result.file.id)
      if (!draftTitle.trim()) {
        setDraftTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 100))
      }
      setGalleryMessage('Image uploaded. Save to publish it in the gallery.')
    } catch (error) {
      setGalleryMessage(
        error instanceof Error
          ? error.message
          : 'The image could not be uploaded. Please try again.',
      )
    } finally {
      setIsUploadingGalleryImage(false)
    }
  }
  const removeGalleryItem = async (item: GalleryItem) => {
    if (!window.confirm(`Remove "${item.title}" from the public gallery?`)) {
      return
    }
    setDeletingGalleryItem(item.id)
    setGalleryMessage('')
    try {
      const result = await deleteGalleryItem(item.id)
      if (!result.ok || !result.removedId) {
        setGalleryMessage(result.error ?? 'Could not remove this gallery item.')
        return
      }
      setGalleryItems((current) =>
        current.filter((entry) => entry.id !== result.removedId),
      )
      if (editingGallery === item.id) cancelGalleryEdit()
      setGalleryMessage('Gallery item removed.')
    } catch {
      setGalleryMessage('Could not remove this gallery item. Please try again.')
    } finally {
      setDeletingGalleryItem('')
    }
  }

  return (
    <main className="min-h-screen bg-secondary/30 text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-border bg-primary p-6 text-primary-foreground lg:flex">
        <a href="/admin" className="font-serif text-2xl tracking-tight">
          Tina<span className="text-accent">.</span>Joe
        </a>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/80">
          Studio workspace
        </p>
        <nav className="mt-12 flex flex-col gap-2">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${active === item.id ? 'bg-primary-foreground/15' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'}`}
              >
                <Icon data-icon="inline-start" />
                {item.label}
                {item.count ? (
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {item.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-primary-foreground/15 p-4 text-sm">
          <Sparkles className="mb-3" />
          <p className="font-medium">
            <AdminGreeting name={adminName} />
          </p>
          <p className="mt-1 leading-5 text-primary-foreground/85">
            Your studio is looking lovely today.
          </p>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-5 sm:py-5 md:px-10">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Studio workspace
            </p>
            <h1 className="mt-2 font-serif text-2xl sm:text-3xl">
              {active === 'overview'
                ? <AdminGreeting name={adminName} />
                : nav.find((item) => item.id === active)?.label}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              View website
            </a>
            <AdminSignOutButton />
          </div>
        </header>
        <div className="min-w-0 p-4 sm:p-5 md:p-10">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${active === item.id ? 'bg-primary text-primary-foreground' : 'border-border bg-card'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {active === 'overview' && (
            <Overview
              orders={orders}
              onRequests={() => setActive('requests')}
              onConfirmations={() => setActive('confirmations')}
            />
          )}
          {active === 'requests' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
              <Requests
                orders={requestOrders}
                selected={selected}
                onSelect={(order) => {
                  setSelectedId(order.id)
                  setApprovalNote(order.approvalNote || defaultApprovalNote)
                  setRejectionNote(order.rejectionNote || defaultRefundNote)
                  setRequestError('')
                  setRequestMessage('')
                }}
              />
              {selected ? (
                <ApprovalPanel
                  order={selected}
                  approvalNote={approvalNote}
                  setApprovalNote={setApprovalNote}
                  rejectionNote={rejectionNote}
                  setRejectionNote={setRejectionNote}
                  requestAction={requestAction}
                  requestError={requestError}
                  requestMessage={requestMessage}
                  onApprove={() => updateRequest('approve')}
                  onReject={() => updateRequest('reject')}
                  onResendRefundEmail={() =>
                    updateRequest('resend_refund_email')
                  }
                  onRetryRefund={() => updateRequest('retry_refund')}
                />
              ) : (
                <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                  No cake requests have been submitted yet.
                </p>
              )}
            </div>
          )}
          {active === 'confirmations' && (
            <Confirmations orders={orders} />
          )}
          {active === 'gallery' && (
            <Gallery
              categories={galleryCategories}
              items={galleryItems}
              editingIndex={editingGallery}
              isCreatingItem={isCreatingGalleryItem}
              openCategoryId={openGalleryCategoryId}
              title={draftTitle}
              categoryId={draftCategoryId}
              image={draftImage}
              message={galleryMessage}
              isCreatingCategory={isCreatingGalleryCategory}
              isUploadingImage={isUploadingGalleryImage}
              isSavingItem={isSavingGalleryItem}
              deletingItemId={deletingGalleryItem}
              newCategoryName={newGalleryCategoryName}
              setTitle={setDraftTitle}
              setCategoryId={selectGalleryCategory}
              onOpenCategory={setOpenGalleryCategoryId}
              setNewCategoryName={setNewGalleryCategoryName}
              onCreateCategory={createGalleryCategoryHandler}
              onUpload={beginUpload}
              onEdit={editGalleryItem}
              onSave={saveGalleryItem}
              onCancel={cancelGalleryEdit}
              onDelete={removeGalleryItem}
              onFile={uploadGalleryImageFile}
            />
          )}
          {active === 'pricing' && (
            <Pricing
              initialDeliveryPrices={initialDeliveryPrices}
              initialDeliveryPerKmRates={initialDeliveryPerKmRates}
              initialMaxDeliveryKm={initialMaxDeliveryKm}
              initialProductPrices={initialProductPrices}
              initialProductCatalog={initialProductCatalog}
            />
          )}
          {active === 'calendar' && (
            <Calendar initialBlockedDates={initialBlockedDates} />
          )}
          {active === 'settings' && (
            <Settings
              email={studioEmail}
              phone={studioPhone}
              pickupAddress={pickupAddress}
              setEmail={setStudioEmail}
              setPhone={setStudioPhone}
              onAddressChange={(address) => {
                setPickupAddress(address)
                setPickupCoordinates(null)
              }}
              onAddressSelect={(suggestion) => {
                setPickupAddress(suggestion.label)
                setPickupCoordinates(
                  suggestion.latitude !== undefined &&
                    suggestion.longitude !== undefined
                    ? {
                        lat: suggestion.latitude,
                        lng: suggestion.longitude,
                      }
                    : null,
                )
              }}
              initialTeamMembers={initialTeamMembers}
              initialAdminInvitations={initialAdminInvitations}
              onSave={() =>
                updateStudioSettings({
                  email: studioEmail,
                  phone: studioPhone,
                  bakeryAddress: pickupAddress,
                  bakeryCoordinates: pickupCoordinates,
                })
              }
            />
          )}
        </div>
      </div>
    </main>
  )
}

function Overview({
  orders,
  onRequests,
  onConfirmations,
}: {
  orders: Order[]
  onRequests: () => void
  onConfirmations: () => void
}) {
  const latestRequests = orders
    .filter((order) => !['Confirmed', 'In progress'].includes(order.status))
    .slice(0, 3)
  const pending = orders.filter(
    (order) => order.payment === 'Awaiting payment',
  ).length
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="New requests"
          value={String(
            orders.filter((order) => order.status === 'New request').length,
          )}
          detail="Need your attention"
        />
        <Stat
          label="Awaiting payment"
          value={String(pending)}
          detail="Customer checkout in progress"
        />
        <Stat
          label="Confirmed orders"
          value={String(
            orders.filter(
              (order) =>
                order.status === 'Confirmed' || order.status === 'In progress',
            ).length,
          )}
          detail="Paid or in progress"
        />
        <Stat
          label="Next collection"
          value={orders[0]?.date.split(' ').slice(0, 2).join(' ') ?? '—'}
          detail={orders[0]?.name ?? 'No requests yet'}
        />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Needs your attention
              </p>
              <h2 className="mt-1 font-serif text-2xl">Latest requests</h2>
            </div>
            <button
              onClick={onRequests}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all
            </button>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {latestRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open cake requests to review.
              </p>
            ) : null}
            {latestRequests.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium capilalize">{order.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">
                    {formatAmount(
                      order.estimate + (order.deliveryFee ?? 0),
                      order.currency,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-primary p-6 text-primary-foreground">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/85">
            Payment workflow
          </p>
          <h2 className="mt-3 font-serif text-3xl">Paid before review.</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-primary-foreground/85">
            Customers pay the full cake and delivery total at checkout. Review
            paid requests, approve with a note, or reject to request a full
            refund.
          </p>
          <button
            onClick={onConfirmations}
            className="mt-8 rounded-full bg-primary-foreground px-4 py-2 text-sm text-primary"
          >
            View confirmations
          </button>
        </section>
      </div>
    </>
  )
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 font-serif text-4xl">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground capitalize ">{detail}</p>
    </div>
  )
}

function Requests({
  orders,
  selected,
  onSelect,
}: {
  orders: Order[]
  selected?: Order
  onSelect: (order: Order) => void
}) {
  return (
    <section>
      {/* <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        Select a request to review the customer’s contact, pickup or delivery
        preference, date, and full cake customization.
      </p> */}
      <div className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            No open cake requests. Approved orders appear in Cake confirmations.
          </p>
        ) : null}
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => onSelect(order)}
            className={`flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl border p-4 text-left transition sm:flex-row sm:items-center sm:p-5 ${selected?.id === order.id ? 'border-primary bg-card shadow-sm' : 'border-border bg-card/60 hover:bg-card'}`}
          >
            <div>
              <p className="font-medium capitalize">{order.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.type} · {order.date}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.details}
              </p>
              <OrderTierDetails tiers={order.tiers} compact />
            </div>
            <div className="text-right">
              <p className="font-mono text-sm">
                {formatAmount(
                  order.estimate + (order.deliveryFee ?? 0),
                  order.currency,
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {order.status} · {order.payment}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function ApprovalPanel({
  order,
  approvalNote,
  setApprovalNote,
  rejectionNote,
  setRejectionNote,
  requestAction,
  requestError,
  requestMessage,
  onApprove,
  onReject,
  onResendRefundEmail,
  onRetryRefund,
}: {
  order: Order
  approvalNote: string
  setApprovalNote: (value: string) => void
  rejectionNote: string
  setRejectionNote: (value: string) => void
  requestAction:
    | 'approve'
    | 'reject'
    | 'retry_refund'
    | 'resend_refund_email'
    | null
  requestError: string
  requestMessage: string
  onApprove: () => void
  onReject: () => void
  onResendRefundEmail: () => void
  onRetryRefund: () => void
}) {
  const [isInspirationOpen, setIsInspirationOpen] = useState(false)
  const total = order.estimate + (order.deliveryFee ?? 0)
  const isPaidRequest =
    order.payment === 'Paid' && order.status === 'New request'
  const isApprovalPending = order.status === 'Approval email pending'
  const isRefundPending = order.status === 'Refund pending'
  const isRejected = order.status === 'Rejected'

  return (
    <aside className="h-fit rounded-2xl border border-border bg-card p-5 xl:sticky xl:top-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {order.id}
          </p>
          <h2 className="mt-2 font-serif text-2xl">Order review</h2>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">
          {order.status}
        </span>
      </div>
      <div className="mt-5 rounded-xl bg-secondary p-4 text-sm leading-6">
        <p className="font-medium capitalize">{order.name}</p>
        <p className="text-muted-foreground">
          {order.email} · {order.phone}
        </p>
        <p className="mt-2">
          <strong>{order.fulfillment}</strong> · {order.date}
        </p>
        {order.fulfillment === 'Delivery' ? (
          <p className="text-muted-foreground">
            {order.address}, {order.postcode}
          </p>
        ) : (
          <p className="text-muted-foreground">
            pickup · {order.address || 'contact the studio for details'}
          </p>
        )}
        {order.tiers.length ? (
          <>
            <p className="mt-3 text-sm font-medium">Cake tiers</p>
            <OrderTierDetails tiers={order.tiers} />
          </>
        ) : null}
        <p className="mt-2 text-muted-foreground">{order.details}</p>
        {order.toppings ? (
          <p className="text-muted-foreground">{order.toppings}</p>
        ) : null}
        {order.referenceImage ? (
          <button
            type="button"
            onClick={() => setIsInspirationOpen(true)}
            className="mt-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-background"
          >
            View inspiration photo
          </button>
        ) : null}
        {order.note && (
          <p className="mt-2 italic text-muted-foreground">“{order.note}”</p>
        )}
      </div>
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span>Cake estimate</span>
          <span>{formatOrderPrice(order)}</span>
        </div>
        {order.fulfillment === 'Delivery' ? (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>Delivery fee</span>
            <span>
              {formatAmount(order.deliveryFee ?? 0, order.currency)}
            </span>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="font-medium">Full amount</span>
          <strong className="font-serif text-2xl">
            {formatAmount(total, order.currency)}
          </strong>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Payment status: {order.payment}
        </p>
      </div>

      {isPaidRequest || isApprovalPending ? (
        <label className="mt-4 block text-sm font-medium">
          Approval note for the customer
          <textarea
            value={approvalNote}
            readOnly={isApprovalPending}
            onChange={(event) => setApprovalNote(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm read-only:opacity-70"
          />
        </label>
      ) : null}
      {isPaidRequest ? (
        <label className="mt-4 block text-sm font-medium">
          Refund note (sent if you reject)
          <textarea
            value={rejectionNote}
            onChange={(event) => setRejectionNote(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
          />
        </label>
      ) : null}

      {isPaidRequest ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={requestAction !== null}
            onClick={onApprove}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-60"
          >
            <Mail />
            {requestAction === 'approve' ? 'Sending approval…' : 'Approve order'}
          </button>
          <button
            disabled={requestAction !== null}
            onClick={onReject}
            className="flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-3 text-sm text-destructive disabled:opacity-60"
          >
            <X />
            {requestAction === 'reject' ? 'Requesting refund…' : 'Reject & refund'}
          </button>
        </div>
      ) : null}
      {isApprovalPending ? (
        <button
          disabled={requestAction !== null}
          onClick={onApprove}
          className="mt-4 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-60"
        >
          <Mail />
          {requestAction === 'approve'
            ? 'Retrying approval email…'
            : 'Retry approval email'}
        </button>
      ) : null}
      {isRejected ? (
        <button
          disabled={requestAction !== null}
          onClick={onResendRefundEmail}
          className="mt-4 flex items-center gap-2 rounded-full border border-border px-4 py-3 text-sm disabled:opacity-60"
        >
          <Mail />
          {requestAction === 'resend_refund_email'
            ? 'Sending refund email…'
            : 'Resend refund email'}
        </button>
      ) : null}
      {order.status === 'Awaiting payment' ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          Approval and rejection are available after Paystack verifies the full
          payment.
        </p>
      ) : null}
      {order.status === 'Payment failed' ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          Checkout was not completed. This request cannot be approved or
          rejected.
        </p>
      ) : null}
      {isApprovalPending ? (
        <p className="mt-3 text-xs text-muted-foreground">
          The approval email has not been confirmed as delivered. Retry it to
          move this paid order to Cake confirmations.
        </p>
      ) : null}
      {isRefundPending ? (
        <div className="mt-4 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
          <p>
            The refund result is not confirmed yet. Check the Paystack dashboard
            before attempting another refund.
          </p>
          <button
            disabled={requestAction !== null}
            onClick={onRetryRefund}
            className="mt-3 rounded-full border border-border px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            {requestAction === 'retry_refund'
              ? 'Retrying refund…'
              : 'Retry refund (after checking Paystack)'}
          </button>
        </div>
      ) : null}
      {requestError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {requestError}
        </p>
      ) : null}
      {requestMessage ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {requestMessage}
        </p>
      ) : null}
      {isInspirationOpen && order.referenceImage ? (
        <InspirationImageDialog
          image={order.referenceImage}
          onClose={() => setIsInspirationOpen(false)}
        />
      ) : null}
    </aside>
  )
}

function Confirmations({ orders }: { orders: Order[] }) {
  const [previewImage, setPreviewImage] =
    useState<NonNullable<Order['referenceImage']> | null>(null)
  const confirmed = orders.filter(
    (order) =>
      order.status === 'Confirmed' || order.status === 'In progress',
  )

  return (
    <section>
      <p className="text-sm leading-6 text-muted-foreground">
        Paid orders approved by the studio.
      </p>
      {confirmed.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No approved orders yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {confirmed.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {order.id} · {order.date}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl capitalize">{order.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {order.email} · {order.phone}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                    {order.status}
                  </span>
                  {/* <p className="mt-2 text-sm">{order.payment}</p> */}
                </div>
              </div>
              <div className="mt-4 grid gap-4 border-t border-border pt-4 ">

              <div>
                  <p className="text-sm font-medium">
                    {order.fulfillment} · {order.date}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.fulfillment === 'Delivery'
                      ? `${order.address}, ${order.postcode}`
                      : order.address || 'Contact the studio for pickup details'}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Cake order</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.type}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {order.details}
                  </p>
                  <OrderTierDetails tiers={order.tiers} />
                  {order.toppings ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Toppings: {order.toppings}
                    </p>
                  ) : null}
                  {order.note ? (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      Customer note: “{order.note}”
                    </p>
                  ) : null}
                </div>
                
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span>Paid in full</span>
                <strong>
                  {formatAmount(
                    order.estimate + (order.deliveryFee ?? 0),
                    order.currency,
                  )}
                </strong>
              </div>
              {order.approvalNote ? (
                <p className="mt-3 rounded-xl bg-secondary p-3 text-sm">
                  Approval note: {order.approvalNote}
                </p>
              ) : null}
              {order.referenceImage ? (
                <button
                  type="button"
                  onClick={() => setPreviewImage(order.referenceImage)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Eye aria-hidden="true" className="size-4" />
                  View inspiration photo
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {previewImage ? (
        <InspirationImageDialog
          image={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </section>
  )
}

function Gallery({
  categories,
  items,
  editingIndex,
  isCreatingItem,
  openCategoryId,
  title,
  categoryId,
  image,
  message,
  isCreatingCategory,
  isUploadingImage,
  isSavingItem,
  deletingItemId,
  newCategoryName,
  setTitle,
  setCategoryId,
  onOpenCategory,
  setNewCategoryName,
  onCreateCategory,
  onUpload,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onFile,
}: {
  categories: GalleryCategory[]
  items: GalleryItem[]
  editingIndex: string | null
  isCreatingItem: boolean
  openCategoryId: string
  title: string
  categoryId: string
  image: string
  message: string
  isCreatingCategory: boolean
  isUploadingImage: boolean
  isSavingItem: boolean
  deletingItemId: string
  newCategoryName: string
  setTitle: (value: string) => void
  setCategoryId: (value: string) => void
  onOpenCategory: (value: string) => void
  setNewCategoryName: (value: string) => void
  onCreateCategory: () => void
  onUpload: (categoryId?: string) => void
  onEdit: (id: string) => void
  onSave: () => void
  onCancel: () => void
  onDelete: (item: GalleryItem) => void
  onFile: (file?: File) => void
}) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Create a category first, then add public gallery images to it.
          </p>
          <h2 className="mt-1 font-serif text-3xl">Studio gallery</h2>
        </div>
        <button
          type="button"
          onClick={() => onUpload()}
          disabled={categories.length === 0 || isUploadingImage}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          <Upload /> Add gallery image
        </button>
      </div>
      <form
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          onCreateCategory()
        }}
      >
        <label className="flex-1 text-sm">
          New gallery category
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            maxLength={60}
            placeholder="e.g. Wedding cakes"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isCreatingCategory || !newCategoryName.trim()}
          className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50"
        >
          {isCreatingCategory ? 'Creating…' : 'Create category'}
        </button>
      </form>
      {message ? (
        <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {(editingIndex !== null || isCreatingItem) && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[140px_1fr]">
          <div className="flex items-center justify-center overflow-hidden rounded-xl bg-secondary">
            {image ? (
              <img
                src={image}
                alt="Gallery work preview"
                className="h-32 w-full object-cover"
              />
            ) : isUploadingImage ? (
              <span className="p-3 text-center text-sm text-muted-foreground">
                Uploading image…
              </span>
            ) : (
              <ImagePlus />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Work title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                required
                placeholder="e.g. Blush floral birthday"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Category
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Upload />
              Choose or replace image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!categoryId || isUploadingImage}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  onFile(file)
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={
                  isUploadingImage ||
                  isSavingItem ||
                  !image ||
                  !categoryId ||
                  !title.trim()
                }
                className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {isSavingItem
                  ? 'Saving…'
                  : editingIndex
                    ? 'Save changes'
                    : 'Save image'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-6 space-y-3">
        {categories.map((category) => {
          const categoryItems = items.filter(
            (item) => item.categoryId === category.id,
          )
          const isOpen = openCategoryId === category.id

          return (
            <section
              key={category.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-3 bg-secondary/50 p-4">
                <button
                  type="button"
                  onClick={() =>
                    onOpenCategory(isOpen ? '' : category.id)
                  }
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  {isOpen ? (
                    <FolderOpen aria-hidden="true" className="size-5 shrink-0" />
                  ) : (
                    <Folder aria-hidden="true" className="size-5 shrink-0" />
                  )}
                  <span className="truncate font-medium capitalize">{category.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {categoryItems.length}{' '}
                    {categoryItems.length === 1 ? 'image' : 'images'}
                  </span>
                  {isOpen ? (
                    <ChevronDown aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onUpload(category.id)}
                  disabled={isUploadingImage}
                  className="shrink-0 rounded-full border border-border px-3 py-2 text-xs hover:bg-background disabled:opacity-50"
                >
                  Add image
                </button>
              </div>
              {isOpen ? (
                categoryItems.length ? (
                  <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryItems.map((item) => (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-border bg-background"
                      >
                        <img
                          src={item.image}
                          alt={item.title}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="p-4">
                          <p className="font-serif text-xl">{item.title}</p>
                          <button
                            type="button"
                            onClick={() => onEdit(item.id)}
                            className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Settings2 /> Edit details
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            disabled={Boolean(deletingItemId)}
                            className="mt-3 flex items-center gap-2 text-sm text-destructive disabled:opacity-50"
                          >
                            <Trash2
                              aria-hidden="true"
                              className="size-4"
                            />
                            {deletingItemId === item.id
                              ? 'Removing…'
                              : 'Remove image'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">
                    This category is empty. Add an image to this folder.
                  </p>
                )
              ) : null}
            </section>
          )
        })}
        {categories.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No gallery categories yet. Create a category before adding images.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function Pricing({
  initialDeliveryPrices,
  initialDeliveryPerKmRates,
  initialMaxDeliveryKm,
  initialProductPrices,
  initialProductCatalog,
}: {
  initialDeliveryPrices: Partial<Record<Currency, number>>
  initialDeliveryPerKmRates: Partial<Record<Currency, number>>
  initialMaxDeliveryKm: number
  initialProductPrices: CurrencyPriceMap
  initialProductCatalog: ProductCatalogItem[]
}) {
  const [isSavingDeliveryFee, setIsSavingDeliveryFee] = useState(false)
  const [deliveryFeeMessage, setDeliveryFeeMessage] = useState('')
  const [deliveryPriceDraft, setDeliveryPriceDraft] = useState<
    Record<Currency, string>
  >(() => ({
    NGN: initialDeliveryPrices.NGN?.toString() ?? '',
    EUR: initialDeliveryPrices.EUR?.toString() ?? '',
    USD: initialDeliveryPrices.USD?.toString() ?? '',
  }))
  const [deliveryPerKmDraft, setDeliveryPerKmDraft] = useState<
    Record<Currency, string>
  >(() => ({
    NGN: initialDeliveryPerKmRates.NGN?.toString() ?? '',
    EUR: initialDeliveryPerKmRates.EUR?.toString() ?? '',
    USD: initialDeliveryPerKmRates.USD?.toString() ?? '',
  }))
  const [deletingCategory, setDeletingCategory] = useState('')
  const [deletingProductId, setDeletingProductId] = useState('')
  const [priceCurrency, setPriceCurrency] = useState<Currency>('NGN')
  const [productCatalog, setProductCatalog] = useState(initialProductCatalog)
  const [storedProductPrices, setStoredProductPrices] =
    useState(initialProductPrices)
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialProductCatalog.map((item) => [
        item.id,
        initialProductPrices[item.id]?.NGN?.toString() ?? '',
      ]),
    ),
  )
  const [isSavingPrices, setIsSavingPrices] = useState(false)
  const [priceMessage, setPriceMessage] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [newProductKind, setNewProductKind] = useState<ProductKind | ''>('')
  const [newProductAmount, setNewProductAmount] = useState('')
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [newProductMessage, setNewProductMessage] = useState('')

  async function saveDeliveryFeePrices() {
    setIsSavingDeliveryFee(true)
    setDeliveryFeeMessage('')
    try {
      const result = await saveDeliveryPrices(
        SUPPORTED_CURRENCIES.map((currency) => ({
          currency,
          amount: deliveryPriceDraft[currency],
          perKmAmount: deliveryPerKmDraft[currency],
        })),
      )
      setDeliveryFeeMessage(
        result.ok
          ? 'Delivery prices saved for each market.'
          : result.error ?? 'Could not save delivery prices. Please try again.',
      )
    } catch {
      setDeliveryFeeMessage('Could not save delivery prices. Please try again.')
    } finally {
      setIsSavingDeliveryFee(false)
    }
  }

  async function removeCategory(category: string) {
    if (
      !window.confirm(
        `Deactivate the entire "${category}" category and all its products? Existing orders and saved prices will be kept.`,
      )
    ) {
      return
    }

    setDeletingCategory(category)
    setPriceMessage('')
    try {
      const result = await deleteProductCategory(category)
      if (!result.ok || !result.removedIds) {
        setPriceMessage(result.error ?? 'Could not remove this category.')
        return
      }

      const removedIds = new Set(result.removedIds)
      setProductCatalog((current) =>
        current.filter((item) => !removedIds.has(item.id)),
      )
      setStoredProductPrices((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => !removedIds.has(id)),
        ),
      )
      setPriceDraft((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => !removedIds.has(id)),
        ),
      )
      setPriceMessage(result.message ?? 'Category removed.')
    } catch {
      setPriceMessage('Could not remove this category. Please try again.')
    } finally {
      setDeletingCategory('')
    }
  }

  async function removeProduct(item: ProductCatalogItem) {
    if (
      !window.confirm(
        `Remove "${item.name}" from the storefront? Existing orders and saved prices will be kept.`,
      )
    ) {
      return
    }

    setDeletingProductId(item.id)
    setPriceMessage('')
    try {
      const result = await deleteProductCatalogItem(item.id)
      if (!result.ok || !result.removedId) {
        setPriceMessage(result.error ?? 'Could not remove this product.')
        return
      }

      setProductCatalog((current) =>
        current.filter((product) => product.id !== result.removedId),
      )
      setPriceMessage(result.message ?? 'Product removed.')
    } catch {
      setPriceMessage('Could not remove this product. Please try again.')
    } finally {
      setDeletingProductId('')
    }
  }

  function changePriceCurrency(currency: Currency) {
    setPriceCurrency(currency)
    setPriceDraft(
      Object.fromEntries(
        productCatalog.map((item) => [
          item.id,
          storedProductPrices[item.id]?.[currency]?.toString() ?? '',
        ]),
      ),
    )
    setPriceMessage('')
  }

  async function savePrices() {
    setIsSavingPrices(true)
    setPriceMessage('')
    try {
      const result = await saveProductPrices(
        priceCurrency,
        productCatalog.map((item) => ({
          productId: item.id,
          amount: priceDraft[item.id] ?? '',
        })),
      )
      if (result.ok) {
        setStoredProductPrices((current) => {
          const next = { ...current }
          for (const item of productCatalog) {
            const amount = priceDraft[item.id]?.trim()
            next[item.id] = { ...next[item.id] }
            if (!amount) {
              delete next[item.id][priceCurrency]
            } else {
              next[item.id][priceCurrency] = Number(amount)
            }
          }
          return next
        })
      }
      setPriceMessage(
        result.ok
          ? result.message ?? `${priceCurrency} prices saved.`
          : result.error ?? 'Could not save product prices.',
      )
    } catch {
      setPriceMessage('Could not save product prices. Please try again.')
    } finally {
      setIsSavingPrices(false)
    }
  }

  async function addProduct() {
    setIsAddingProduct(true)
    setNewProductMessage('')
    try {
      const result = await addProductCatalogItem({
        name: newProductName,
        kind: newProductKind,
        currency: priceCurrency,
        amount: newProductAmount,
      })
      if (!result.ok || !result.item) {
        setNewProductMessage(result.error ?? 'Could not add this product.')
        return
      }

      const item = result.item
      setProductCatalog((current) => [...current, item])
      setStoredProductPrices((current) => ({
        ...current,
        [item.id]: { [result.currency]: result.amount },
      }))
      setPriceDraft((current) => ({
        ...current,
        [item.id]: result.currency === priceCurrency
          ? result.amount.toString()
          : '',
      }))
      setNewProductName('')
      setNewProductKind('')
      setNewProductAmount('')
      setNewProductMessage(result.message ?? 'Product added.')
    } catch {
      setNewProductMessage('Could not add this product. Please try again.')
    } finally {
      setIsAddingProduct(false)
    }
  }

  return (
    <section className="max-w-4xl">
      <p className="text-sm text-muted-foreground">
        Set independent prices for each market and manage the products offered by the studio.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl">Delivery prices by market</h2>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="About delivery pricing"
                  aria-describedby="delivery-pricing-hint"
                  className="rounded-full text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
                <span
                  id="delivery-pricing-hint"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  Set a base charge and a per-kilometre rate for each currency.
                  The base charge covers the first 5 km; the rate is added for
                  each kilometre beyond that, up to {initialMaxDeliveryKm} km.
                  No currency conversion is applied.
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={saveDeliveryFeePrices}
            disabled={isSavingDeliveryFee}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            <Save /> {isSavingDeliveryFee ? 'Saving…' : 'Save prices'}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SUPPORTED_CURRENCIES.map((currency) => (
            <div key={currency} className="grid gap-3">
              <label className="block text-sm">
                <div className="flex items-center gap-2 justify-between">
                ({currency})
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  inputMode="decimal"
                  value={deliveryPriceDraft[currency]}
                  onChange={(event) => {
                    setDeliveryPriceDraft((current) => ({
                      ...current,
                      [currency]: event.target.value,
                    }))
                    setDeliveryFeeMessage('')
                  }}
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-right"
                  aria-label={`Base delivery charge in ${currency}`}
                />
                </div>
              </label>
              <label className="block text-sm">
                <div className="flex items-center gap-2 justify-between">
                 For Extra 5 km ({currency})
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  inputMode="decimal"
                  value={deliveryPerKmDraft[currency]}
                  onChange={(event) => {
                    setDeliveryPerKmDraft((current) => ({
                      ...current,
                      [currency]: event.target.value,
                    }))
                    setDeliveryFeeMessage('')
                  }}
                  className="mt-2 w-[80%] rounded-xl border border-input bg-background px-3 py-3 text-right"
                  aria-label={`Extra delivery charge per kilometre in ${currency}`}
                />
                </div>
              </label>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Leave both fields blank for a market to disable delivery quotes.
          Enter 0 as the per-kilometre rate for a flat charge within the service
          area.
        </p>
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
          {deliveryFeeMessage}
        </p>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl">Catalogue pricing</h2>
            <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="About delivery pricing"
                  aria-describedby="delivery-pricing-hint"
                  className="rounded-full text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
                <span
                  id="delivery-pricing-hint"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  Enter market prices manually. No exchange-rate conversions are
                  used. NGN is the storefront fallback.
                </span>
              </span>
           
          </div>
          <button
            type="button"
            onClick={savePrices}
            disabled={isSavingPrices}
            className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            <Save /> {isSavingPrices ? 'Saving…' : `Save ${priceCurrency} prices`}
          </button>
        </div>
        <div className="border-b border-border p-5">
          <label className="block max-w-xs text-sm">
            <div className="flex items-center gap-4">
              Currency 
            <select
              value={priceCurrency}
              onChange={(event) =>
                changePriceCurrency(event.target.value as Currency)
              }
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            </div>
          </label>
          {priceCurrency === 'NGN' ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Set every NGN price before storefront cake estimates can be
              requested. Enter 0 when an option has no extra charge.
            </p>
          ) : null}
          <p aria-live="polite" className="mt-3 min-h-5 text-sm text-muted-foreground">
            {priceMessage}
          </p>
        </div>
        {[...new Set(productCatalog.map((item) => item.category))].map(
          (category) => (
            <section key={category} className="border-b border-border last:border-0">
              <div className="flex items-center justify-between bg-secondary/50 px-5 py-3">
                <h3 className="font-medium">{category}</h3>
                {/* <button
                  type="button"
                  onClick={() => void removeCategory(category)}
                  disabled={Boolean(deletingCategory) || Boolean(deletingProductId)}
                  aria-label={`Deactivate ${category} category`}
                  title={`Deactivate ${category} category`}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button> */}
              </div>
              <div className="grid sm:grid-cols-2">
                {productCatalog.filter((item) => item.category === category).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-border p-4 text-sm last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        {item.name}
                        {/* <span className="mt-1 block text-xs text-muted-foreground">
                          {productKindLabel(item.kind)}
                        </span> */}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <label
                          className="sr-only"
                          htmlFor={`price-${item.id}`}
                        >
                          {priceCurrency} price for {item.name}
                        </label>
                        <input
                          id={`price-${item.id}`}
                          type="number"
                          min="0"
                          max="1000000000"
                          step="0.01"
                          inputMode="decimal"
                          value={priceDraft[item.id] ?? ''}
                          onChange={(event) => {
                            setPriceDraft((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                            setPriceMessage('')
                          }}
                          aria-label={`${item.name} ${priceCurrency} price`}
                          className="w-32 rounded-lg border border-input bg-background px-3 py-2 text-right"
                        />
                        <button
                          type="button"
                          onClick={() => void removeProduct(item)}
                          disabled={Boolean(deletingCategory) || Boolean(deletingProductId)}
                          aria-label={`Remove ${item.name}`}
                          title={`Remove ${item.name}`}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          ),
        )}
      </div>
      <form
        className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          void addProduct()
        }}
      >
        <div className="sm:col-span-2 flex items-center gap-2">
          <h2 className="font-serif text-2xl">Add a product or option</h2>
           <span className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="About delivery pricing"
                  aria-describedby="delivery-pricing-hint"
                  className="rounded-full text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
                <span
                  id="delivery-pricing-hint"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  Add another flavour, frosting, filling, topping, cake size, or
                  standalone product such as slice cakes. Every price is entered
                  manually for the selected currency.
                </span>
              </span>
          
        </div>
        <label className="text-sm">
          Product name
          <input
            required
            maxLength={100}
            value={newProductName}
            onChange={(event) => setNewProductName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            placeholder="e.g. Red velvet"
          />
        </label>
        <label className="text-sm">
          Product category
          <select
            required
            value={newProductKind}
            onChange={(event) =>
              setNewProductKind(
                isProductKind(event.target.value) ? event.target.value : '',
              )
            }
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          >
            <option value="" disabled>
              Select a product category
            </option>
            {PRODUCT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {productKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Price ({priceCurrency})
          <input
            required
            type="number"
            min="0"
            max="1000000000"
            step="0.01"
            inputMode="decimal"
            value={newProductAmount}
            onChange={(event) => setNewProductAmount(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={isAddingProduct}
            className="rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60"
          >
            {isAddingProduct ? 'Adding…' : `Add product`}
          </button>
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground sm:col-span-2">
          {newProductMessage}
        </p>
      </form>
    </section>
  )
}
function Calendar({ initialBlockedDates }: { initialBlockedDates: string[] }) {
  const [blockedDates, setBlockedDates] = useState(initialBlockedDates)
  const [selectedDate, setSelectedDate] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const blockDate = async () => {
    if (!selectedDate) {
      setError('Choose a date to block.')
      return
    }
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const result = await blockUnavailableDate(selectedDate)
      if (!result.ok) {
        setError(result.error ?? 'Could not block this date.')
        return
      }
      setBlockedDates((current) =>
        [...current, selectedDate].sort((a, b) => a.localeCompare(b)),
      )
      setSelectedDate('')
      setMessage('Date blocked. Customers can no longer select it.')
    } catch {
      setError('Could not block this date. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const unblockDate = async (date: string) => {
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const result = await unblockUnavailableDate(date)
      if (!result.ok) {
        setError(result.error ?? 'Could not unblock this date.')
        return
      }
      setBlockedDates((current) => current.filter((item) => item !== date))
      setMessage('Date unblocked and available for new orders.')
    } catch {
      setError('Could not unblock this date. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Block dates when your kitchen is fully booked. Customers won’t be able
        to select blocked dates when placing an order.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-serif text-2xl">Availability</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Unavailable date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value)
                setError('')
              }}
              className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
            />
          </label>
          <button
            type="button"
            disabled={isSaving}
            onClick={blockDate}
            className="self-end rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Block date'}
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
        <div className="mt-8">
          <h3 className="text-sm font-medium">Blocked dates</h3>
          {blockedDates.length === 0 ? (
            <p className="mt-3 rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
              No dates are blocked.
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-3">
          {blockedDates.map((date) => (
            <div
              key={date}
              className="flex items-center justify-between rounded-xl bg-secondary p-4 text-sm"
            >
              <span>
                {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => unblockDate(date)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-60"
              >
                Unblock
              </button>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  )
}
function Settings({
  email,
  phone,
  pickupAddress,
  setEmail,
  setPhone,
  onAddressChange,
  onAddressSelect,
  initialTeamMembers,
  initialAdminInvitations,
  onSave,
}: {
  email: string
  phone: string
  pickupAddress: string
  setEmail: (value: string) => void
  setPhone: (value: string) => void
  onAddressChange: (value: string) => void
  onAddressSelect: (suggestion: AddressSuggestion) => void
  initialTeamMembers: AdminTeamMember[]
  initialAdminInvitations: AdminInvitation[]
  onSave: () => Promise<{
    ok: boolean
    message?: string
    error?: string
  }>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  async function saveSettings() {
    setIsSaving(true)
    setSettingsMessage('')
    try {
      const result = await onSave()
      setSettingsMessage(
        result.ok
          ? result.message ?? 'Studio settings saved.'
          : result.error ?? 'Could not save studio settings.',
      )
    } catch {
      setSettingsMessage('Could not save studio settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="max-w-2xl">
      <p className="text-sm text-muted-foreground">
        These contact details appear in customer communications and collection
        instructions.
      </p>
      <div className="mt-6 grid gap-5 rounded-2xl border border-border bg-card p-6">
        <label className="text-sm">
          Studio email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
        <label className="text-sm">
          Studio phone / WhatsApp
          <input
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
        <div className="text-sm">
          <label htmlFor="bakery-address">
            Bakery address for delivery distance
          </label>
          <AddressAutocomplete
            id="bakery-address"
            value={pickupAddress}
            onChange={onAddressChange}
            onSelect={onAddressSelect}
            multiline
            rows={3}
            placeholder="Start typing, e.g. No. 27 Obalende"
          />
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60"
        >
          <Save />
          {isSaving ? 'Checking and saving…' : 'Save settings'}
        </button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {settingsMessage}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Contact details and the bakery address are saved together. The
          address is checked before it is used for delivery distance calculations.
        </p>
      </div>
      <AdminTeamAccess
        initialTeamMembers={initialTeamMembers}
        initialInvitations={initialAdminInvitations}
      />
    </section>
  )
}

function AdminTeamAccess({
  initialTeamMembers,
  initialInvitations,
}: {
  initialTeamMembers: AdminTeamMember[]
  initialInvitations: AdminInvitation[]
}) {
  const [teamMembers] = useState(initialTeamMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const result = await createAdminInvitation({ name, email })
      if (result.invitation) {
        const invitation = result.invitation
        setInvitations((current) => [
          invitation,
          ...current.filter(
            (currentInvitation) =>
              currentInvitation.email !== invitation.email,
          ),
        ])
      }
      if (!result.ok) {
        setError(result.error ?? 'Could not send this invitation.')
        return
      }
      setName('')
      setEmail('')
      setMessage(`Invitation sent to ${result.invitation?.email}.`)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Could not send this invitation. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function revokeInvitation(invitationId: string) {
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const result = await revokeAdminInvitation(invitationId)
      if (!result.ok) {
        setError(result.error ?? 'Could not revoke this invitation.')
        return
      }
      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      )
      setMessage('Invitation revoked.')
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : 'Could not revoke this invitation. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Users aria-hidden="true" size={20} />
        <div>
          <h2 className="font-serif text-xl">Admin team</h2>
          <p className="text-sm text-muted-foreground">
            Invite trusted team members. Every team member has administrator
            access to the studio.
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-border">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div>
              <p className="font-medium capitalize">{member.name}</p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs">
              Admin
            </span>
          </div>
        ))}
      </div>
      {invitations.length ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium">Pending invitations</h3>
          <div className="mt-2 divide-y divide-border">
            {invitations.map((invitation) => {
              const isExpired = new Date(invitation.expiresAt) <= new Date()
              return (
                <div
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium capitalize">{invitation.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {invitation.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isExpired
                        ? 'Expired — invite again to send a new link.'
                        : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => revokeInvitation(invitation.id)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-60"
                  >
                    Revoke
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      <form
        onSubmit={sendInvitation}
        className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2"
      >
        <label className="text-sm">
          Team member name
          <input
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
        <label className="text-sm">
          Team member email
          <input
            required
            type="email"
            maxLength={320}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-muted-foreground sm:col-span-2">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-60"
        >
          <UserPlus aria-hidden="true" size={16} />
          {isSubmitting ? 'Sending invitation…' : 'Invite admin'}
        </button>
      </form>
    </section>
  )
}
