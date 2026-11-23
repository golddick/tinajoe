'use client'

import { useMemo, useState } from 'react'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { useStorefrontPricing } from '@/components/storefront-pricing-provider'
import { calculateCakePrice } from '@/lib/cake-pricing'
import { formatCurrency, type Currency } from '@/lib/pricing-catalog'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImagePlus,
  Minus,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

const designs = [
  { name: 'Minimalist', detail: 'Clean lines & soft texture' },
  { name: 'Floral', detail: 'Hand-piped seasonal blooms' },
  { name: 'Vintage', detail: 'Retro piping & frills' },
  { name: 'Luxury', detail: 'Statement finish & detail' },
]
const colours = ['Blush', 'Lilac', 'Butter yellow', 'Sage', 'Cocoa', 'Pearl']
const steps = [
  'Cake type',
  'Tiers',
  'Tier details',
  'Finish',
  'Details',
  'Review',
]

type Tier = {
  size: number
  layers: number
  flavourId: string
  frostingId: string
  fillingId: string
}

type DeliveryQuoteResult =
  | {
      deliverable: true
      distanceKm: number
      fee: number
      currency: Currency
      error?: never
    }
  | { deliverable: false; error?: string }

type UploadedReferenceImage = {
  id: string
  url: string
  name: string
  mimeType: string
  size?: number
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function dateToIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CakeBuilder({
  maxDeliveryKm,
  blockedDates,
}: {
  maxDeliveryKm: number
  blockedDates: string[]
}) {
  const { currency, preferredCurrency, prices, price, formatPrice, catalog } =
    useStorefrontPricing()
  const flavourOptions = catalog.filter((item) => item.kind === 'flavour')
  const frostingOptions = catalog.filter((item) => item.kind === 'frosting')
  const fillingOptions = catalog.filter((item) => item.kind === 'filling')
  const toppingOptions = catalog.filter((item) => item.kind === 'topping')
  const sizeOptions = catalog.filter((item) => item.kind === 'cake_size')
  const baseProducts = catalog.filter((item) => item.kind === 'base_product')
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState('Celebration cake')
  const [baseProductId, setBaseProductId] = useState<string | null>(null)
  const [tierCount, setTierCount] = useState(1)
  const [tiers, setTiers] = useState<Tier[]>([
    {
      size: 6,
      layers: 2,
      flavourId: 'flavour_vanilla_bean',
      frostingId: 'frosting_whipped_cream',
      fillingId: 'filling_vanilla_buttercream',
    },
  ])
  const [colour, setColour] = useState('Blush')
  const [secondColour, setSecondColour] = useState('Lilac')
  const [ombre, setOmbre] = useState(true)
  const [design, setDesign] = useState('Floral')
  const [selectedToppings, setSelectedToppings] = useState<string[]>([
    'topping_piped_florals',
  ])
  const [topper, setTopper] = useState('Happy Birthday')
  const [notes, setNotes] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [deliveryQuote, setDeliveryQuote] =
    useState<DeliveryQuoteResult | null>(null)
  const [deliveryFeeError, setDeliveryFeeError] = useState('')
  const [isCheckingDeliveryFee, setIsCheckingDeliveryFee] = useState(false)
  const [referenceImage, setReferenceImage] =
    useState<UploadedReferenceImage | null>(null)
  const [referenceImageError, setReferenceImageError] = useState('')
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] =
    useState(false)
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    fulfillment: 'Collection' as 'Collection' | 'Delivery',
    address: '',
    postcode: '',
  })
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const blockedDateSet = useMemo(() => new Set(blockedDates), [blockedDates])
  const calendarStartOffset = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  ).getDay()
  const calendarDayCount = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate()
  const submitRequest = async () => {
    if (subtotal === null || currency === null) {
      setSubmitError(
        'Cake prices are being configured. Please try again later or contact the studio.',
      )
      setStep(5)
      return
    }

    const hasContactDetails =
      customer.name.trim() && customer.email.trim() && customer.phone.trim()
    const hasFulfillmentDetails =
      customer.date &&
      (customer.fulfillment === 'Collection' ||
        (customer.address.trim() && customer.postcode.trim()))
    const needsDeliveryCheck =
      customer.fulfillment === 'Delivery' &&
      (!deliveryQuote?.deliverable ||
        deliveryQuote.currency !== currency)

    if (!hasContactDetails || !hasFulfillmentDetails || needsDeliveryCheck) {
      setSubmitError(
        needsDeliveryCheck
          ? 'Check your delivery address before requesting approval.'
          : 'Please complete your name, email, phone number, preferred date, and delivery address and postcode if delivery is selected.',
      )
      setStep(4)
      return
    }

    setSubmitError('')
    setIsSubmittingRequest(true)
    try {
      const response = await fetch('/api/cake-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          customer,
          tiers: tiers.map((tier) => ({
            ...tier,
            flavour: flavourOptions.find((item) => item.id === tier.flavourId)?.name ?? '',
            frosting: frostingOptions.find((item) => item.id === tier.frostingId)?.name ?? '',
            filling: fillingOptions.find((item) => item.id === tier.fillingId)?.name ?? '',
          })),
          design: {
            colour,
            secondColour,
            ombre,
            design,
            toppings: selectedToppings.flatMap((id) => {
              const topping = toppingOptions.find((item) => item.id === id)
              return topping ? [topping.name] : []
            }),
            toppingIds: selectedToppings,
            baseProductId,
            baseProductName: baseProductId
              ? catalog.find((item) => item.id === baseProductId)?.name
              : undefined,
            topper,
            notes,
          },
          estimate: subtotal,
          currency,
          referenceImage,
        }),
      })
      const result = (await response.json()) as {
        authorizationUrl?: unknown
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error || 'Checkout could not be started.')
      }
      if (typeof result.authorizationUrl !== 'string') {
        throw new Error('Checkout could not be started. Please try again.')
      }
      window.location.assign(result.authorizationUrl)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Checkout could not be started. Please try again.',
      )
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const checkDeliveryFee = async () => {
    if (!customer.address.trim() || !customer.postcode.trim()) {
      setDeliveryFeeError('Enter both a delivery address and postcode.')
      return
    }
    if (!currency) {
      setDeliveryFeeError('Delivery prices are not configured for this market.')
      return
    }

    setIsCheckingDeliveryFee(true)
    setDeliveryFeeError('')
    setDeliveryQuote(null)

    try {
      const response = await fetch('/api/delivery-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: customer.address.trim(),
          postcode: customer.postcode.trim(),
          currency,
        }),
      })
      const result = (await response.json()) as DeliveryQuoteResult

      if (result.error === 'bakery_address_not_configured') {
        setDeliveryFeeError(
          'Delivery is not available until the bakery address is configured.',
        )
      } else if (result.error === 'delivery_price_not_configured') {
        setDeliveryFeeError(
          `Delivery prices are not configured for ${currency}. Select another market or contact the studio.`,
        )
      } else if (!response.ok || !result.deliverable) {
        setDeliveryFeeError(
          result.error === 'geocode_failed'
            ? 'We could not verify that address. Check it and try again.'
            : 'This address is outside the bakery delivery area.',
        )
      } else {
        setDeliveryQuote(result)
      }
    } catch {
      setDeliveryFeeError('Delivery could not be checked. Please try again.')
    } finally {
      setIsCheckingDeliveryFee(false)
    }
  }

  const uploadReferenceImage = async (file?: File) => {
    if (!file) return

    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setReferenceImageError('Choose a JPG, PNG, or WebP image up to 2 MB.')
      return
    }

    setReferenceImage(null)
    setReferenceImageError('')
    setIsUploadingReferenceImage(true)

    try {
      const base64Data = toBase64(new Uint8Array(await file.arrayBuffer()))
      const response = await fetch('/api/files/cake-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          data: base64Data,
        }),
      })
      const result = (await response.json()) as {
        file?: UploadedReferenceImage
        error?: string
      }

      if (!response.ok || !result.file) {
        throw new Error(result.error || 'The image could not be uploaded.')
      }

      setReferenceImage(result.file)
    } catch (error) {
      setReferenceImageError(
        error instanceof Error
          ? error.message
          : 'The image could not be uploaded. Please try again.',
      )
    } finally {
      setIsUploadingReferenceImage(false)
    }
  }

  const subtotal = useMemo(
    () =>
      currency
        ? calculateCakePrice(
            tiers,
            selectedToppings,
            prices,
            currency,
            baseProductId,
          )
        : null,
    [baseProductId, currency, prices, selectedToppings, tiers],
  )
  const formatAmount = (amount: number | null) =>
    amount === null || currency === null
      ? 'Price unavailable'
      : formatCurrency(amount, currency)
  const formatTierPrice = (size: number, layers: number) => {
    if (!currency) return 'Price unavailable'
    const base = price(`cake_size_${size}`)
    const layer = price('extra_layer')
    if (base === undefined || (layers > 2 && layer === undefined)) {
      return 'Price unavailable'
    }
    return formatCurrency(base + (layer ?? 0) * (layers - 2), currency)
  }
  const removeTier = (index: number) => {
    if (tiers.length <= 1) return
    setTiers((current) => current.filter((_, tierIndex) => tierIndex !== index))
    setTierCount((current) => Math.max(1, current - 1))
  }
  const currentDeliveryQuote =
    customer.fulfillment === 'Delivery' &&
    deliveryQuote?.deliverable &&
    deliveryQuote.currency === currency
      ? deliveryQuote
      : null
  const totalEstimate =
    subtotal === null
      ? null
      : subtotal + (currentDeliveryQuote?.fee ?? 0)
  const canShowTotal =
    customer.fulfillment === 'Collection' || currentDeliveryQuote !== null

  const updateTier = (index: number, key: keyof Tier, value: string | number) =>
    setTiers((current) =>
      current.map((tier, i) =>
        i === index ? { ...tier, [key]: value } : tier,
      ),
    )
  const changeTierCount = (count: number) => {
    setTierCount(count)
    setTiers((current) =>
      Array.from(
        { length: count },
        (_, i) =>
          current[i] ?? {
            size: i ? 5 : 6,
            layers: 2,
            flavourId: flavourOptions[0]?.id ?? '',
            frostingId: frostingOptions[0]?.id ?? '',
            fillingId: fillingOptions[0]?.id ?? '',
          },
      ),
    )
  }
  const toggleTopping = (id: string) =>
    setSelectedToppings((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    )

  return (
    <section
      id="builder"
      className="bg-secondary/40 px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              The cake studio
            </p>
            <h2 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
              Build your cake
            </h2>
            <p className="mt-3 max-w-lg leading-7 text-muted-foreground">
              A few thoughtful choices, then we&apos;ll take care of the rest.
              Your price is always an estimate until we approve delivery.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Starting from {formatAmount(subtotal)}
            </span>{' '}
            {currency && currency !== preferredCurrency ? (
              <span className="ml-2 text-xs">
                ({preferredCurrency} prices not configured; showing {currency})
              </span>
            ) : null}
            <span className="mx-1">·</span> delivery calculated after address check
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr_280px]">
          <nav className="flex gap-2 overflow-auto lg:flex-col lg:gap-1">
            {steps.map((label, i) => {
              if (baseProductId && (i === 1 || i === 2)) return null
              return (
              <button
                key={label}
                onClick={() => i <= step && setStep(i)}
                className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm transition ${i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="mr-3 font-mono text-xs">
                  0{i + 1}
                </span>
                {label}
              </button>
              )
            })}
          </nav>
          <div className="min-h-[460px] rounded-[1.5rem] border border-border bg-card p-6 shadow-sm md:p-8">
            {step === 0 && (
              <Step
                title="What are we celebrating?"
                subtitle="Choose a starting point. You can personalise every detail next."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'Celebration cake',
                    'Birthday cake',
                    "Children's cake",
                    'Custom design',
                  ].map((item) => (
                    <Choice
                      key={item}
                      active={category === item}
                      onClick={() => {
                        setCategory(item)
                        setBaseProductId(null)
                      }}
                      title={item}
                      detail={
                        item === "Children's cake"
                          ? 'Characters, names & ages'
                          : 'Thoughtful, made-to-order detail'
                      }
                    />
                  ))}
                  {baseProducts.map((item) => (
                    <Choice
                      key={item.id}
                      active={baseProductId === item.id}
                      onClick={() => {
                        setCategory(item.category)
                        setBaseProductId(item.id)
                        setTierCount(1)
                        setTiers((current) => current.slice(0, 1))
                      }}
                      title={item.category}
                      detail={`${item.name} · ${formatPrice(item.id)}`}
                    />
                  ))}
                </div>
              </Step>
            )}
            {step === 1 && !baseProductId && (
              <Step
                title="How many tiers?"
                subtitle="Each tier can have its own size, layers, flavour and frosting."
              >
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => changeTierCount(n)}
                      className={`rounded-2xl border p-5 text-center ${tierCount === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                    >
                      <span className="block font-serif text-3xl">{n}</span>
                      <span className="text-xs">
                        {n === 1 ? 'tier' : 'tiers'}
                      </span>
                    </button>
                  ))}
                </div>
              </Step>
            )}
            {step === 2 && !baseProductId && (
              <Step
                title="Shape the tiers"
                subtitle="A taller cake adds height and theatre. Choose what feels right."
              >
                <div className="flex flex-col gap-6">
                  {tiers.map((tier, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-medium">Tier {i + 1}</h3>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            from {formatTierPrice(tier.size, tier.layers)}
                          </span>
                          {tiers.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeTier(i)}
                              aria-label={`Remove tier ${i + 1}`}
                              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                            >
                              <X aria-hidden="true" className="size-3.5" />
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                          label="Size"
                          value={`cake_size_${tier.size}`}
                          options={sizeOptions.map((item) => ({
                            value: item.id,
                            label: item.name,
                          }))}
                          onChange={(x) =>
                            updateTier(
                              i,
                              'size',
                              Number(x.replace('cake_size_', '')),
                            )
                          }
                        />
                        <Select
                          label="Layers"
                          value={tier.layers}
                          options={['2 layers', '3 layers', '4 layers']}
                          onChange={(x) =>
                            updateTier(i, 'layers', Number(x.split(' ')[0]))
                          }
                        />
                        <Select
                          label="Flavour"
                          value={tier.flavourId}
                          options={flavourOptions.map((item) => ({
                            value: item.id,
                            label: `${item.name} · ${formatPrice(item.id)}`,
                          }))}
                          onChange={(x) => updateTier(i, 'flavourId', x)}
                        />
                        <Select
                          label="Frosting"
                          value={tier.frostingId}
                          options={frostingOptions.map((item) => ({
                            value: item.id,
                            label: `${item.name} · ${formatPrice(item.id)}`,
                          }))}
                          onChange={(x) => updateTier(i, 'frostingId', x)}
                        />
                        <Select
                          label="Filling"
                          value={tier.fillingId}
                          options={fillingOptions.map((item) => ({
                            value: item.id,
                            label: `${item.name} · ${formatPrice(item.id)}`,
                          }))}
                          onChange={(x) => updateTier(i, 'fillingId', x)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Step>
            )}
            {step === 3 && (
              <Step
                title="The finishing touch"
                subtitle="Colour, mood, and the details that make it yours."
              >
                {baseProductId ? (
                  <div className="mb-7 grid gap-4 sm:grid-cols-3">
                    <Select
                      label="Flavour"
                      value={tiers[0]?.flavourId ?? ''}
                      options={flavourOptions.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${formatPrice(item.id)}`,
                      }))}
                      onChange={(value) =>
                        updateTier(0, 'flavourId', value)
                      }
                    />
                    <Select
                      label="Frosting"
                      value={tiers[0]?.frostingId ?? ''}
                      options={frostingOptions.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${formatPrice(item.id)}`,
                      }))}
                      onChange={(value) =>
                        updateTier(0, 'frostingId', value)
                      }
                    />
                    <Select
                      label="Filling"
                      value={tiers[0]?.fillingId ?? ''}
                      options={fillingOptions.map((item) => ({
                        value: item.id,
                        label: `${item.name} · ${formatPrice(item.id)}`,
                      }))}
                      onChange={(value) =>
                        updateTier(0, 'fillingId', value)
                      }
                    />
                  </div>
                ) : null}
                <label className="mb-3 block text-sm font-medium">
                  Palette
                </label>
                <div className="mb-7 flex flex-wrap gap-2">
                  {colours.map((item) => (
                    <button
                      key={item}
                      onClick={() => setColour(item)}
                      className={`rounded-full border px-4 py-2 text-sm ${colour === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mb-7 grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Second colour"
                    value={secondColour}
                    options={colours}
                    onChange={setSecondColour}
                  />
                  <Select
                    label="Finish"
                    value={ombre ? 'Soft ombré' : 'Single colour'}
                    options={['Soft ombré', 'Single colour']}
                    onChange={(x) => setOmbre(x === 'Soft ombré')}
                  />
                </div>
                <label className="mb-3 block text-sm font-medium">
                  Design direction
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {designs.map((item) => (
                    <Choice
                      key={item.name}
                      active={design === item.name}
                      onClick={() => setDesign(item.name)}
                      title={item.name}
                      detail={item.detail}
                    />
                  ))}
                </div>
                <label className="mt-7 mb-3 block text-sm font-medium">
                  Toppings & extras
                </label>
                <div className="flex flex-wrap gap-2">
                  {toppingOptions.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleTopping(item.id)}
                      className={`rounded-full border px-3 py-2 text-xs ${selectedToppings.includes(item.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                    >
                      {item.name} +{formatPrice(item.id)}
                    </button>
                  ))}
                </div>
              </Step>
            )}
            {step === 4 && (
              <Step
                title="A few final details"
                subtitle="Tell us how to make it personal, and when you'd like it."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Full name
                    <input
                      required
                      autoComplete="name"
                      value={customer.name}
                      onChange={(e) =>
                        setCustomer({ ...customer, name: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="text-sm">
                    Email address
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(e) =>
                        setCustomer({ ...customer, email: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="text-sm">
                    Phone number
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                      placeholder="Your phone number"
                    />
                  </label>
                  <label className="text-sm">
                    Name topper
                    <input
                      value={topper}
                      onChange={(e) => setTopper(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                      placeholder="e.g. Happy Birthday"
                    />
                  </label>
                  <fieldset className="text-sm">
                    <legend className="mb-2">
                      Preferred date <span className="text-destructive">*</span>
                    </legend>
                    <div className="rounded-xl border border-input p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() =>
                            setCalendarMonth(
                              (month) =>
                                new Date(
                                  month.getFullYear(),
                                  month.getMonth() - 1,
                                  1,
                                ),
                            )
                          }
                          className="rounded-full p-2 hover:bg-secondary"
                        >
                          <ChevronLeft aria-hidden="true" size={18} />
                        </button>
                        <p aria-live="polite" className="font-medium">
                          {calendarMonth.toLocaleDateString(undefined, {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() =>
                            setCalendarMonth(
                              (month) =>
                                new Date(
                                  month.getFullYear(),
                                  month.getMonth() + 1,
                                  1,
                                ),
                            )
                          }
                          className="rounded-full p-2 hover:bg-secondary"
                        >
                          <ChevronRight aria-hidden="true" size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                          (day) => (
                            <span
                              key={day}
                              className="py-2 text-xs text-muted-foreground"
                            >
                              {day}
                            </span>
                          ),
                        )}
                        {Array.from(
                          { length: calendarStartOffset },
                          (_, index) => (
                            <span
                              key={`empty-${index}`}
                              aria-hidden="true"
                              className="py-2"
                            />
                          ),
                        )}
                        {Array.from({ length: calendarDayCount }, (_, index) => {
                          const day = index + 1
                          const date = new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth(),
                            day,
                          )
                          const isoDate = dateToIso(date)
                          const isBlocked = blockedDateSet.has(isoDate)
                          const isSelected = customer.date === isoDate

                          return (
                            <button
                              key={isoDate}
                              type="button"
                              aria-label={`${date.toLocaleDateString(undefined, {
                                dateStyle: 'full',
                              })}${isBlocked ? ', unavailable' : ''}`}
                              aria-pressed={isSelected}
                              disabled={isBlocked}
                              onClick={() =>
                                setCustomer({ ...customer, date: isoDate })
                              }
                              className={`rounded-lg py-2 text-sm ${
                                isBlocked
                                  ? 'cursor-not-allowed text-muted-foreground line-through opacity-50'
                                  : isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-secondary'
                              }`}
                            >
                              {day}
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {customer.date
                          ? `Selected: ${customer.date}`
                          : 'Select an available date.'}
                        {blockedDates.length > 0 &&
                          ' Unavailable dates are disabled.'}
                      </p>
                    </div>
                  </fieldset>
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium">
                      How would you like to receive your cake?
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(['Collection', 'Delivery'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setCustomer({ ...customer, fulfillment: method })
                          }
                          className={`rounded-xl border p-4 text-left text-sm ${customer.fulfillment === method ? 'border-primary bg-secondary' : 'border-border'}`}
                        >
                          <strong>{method}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {method === 'Collection'
                              ? 'Collect from our studio'
                              : 'Check your address for the delivery fee'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {customer.fulfillment === 'Delivery' ? (
                    <>
                      <div className="text-sm sm:col-span-2">
                        <label htmlFor="delivery-address">
                          Delivery address
                        </label>
                        <AddressAutocomplete
                          id="delivery-address"
                          required
                          value={customer.address}
                          onChange={(address) => {
                            setCustomer({ ...customer, address })
                            setDeliveryQuote(null)
                            setDeliveryFeeError('')
                          }}
                          onSelect={(suggestion) => {
                            setCustomer({
                              ...customer,
                              address: suggestion.address,
                              postcode: suggestion.postcode,
                            })
                            setDeliveryQuote(null)
                            setDeliveryFeeError('')
                          }}
                          placeholder="Start typing, e.g. No. 27 Obalende"
                        />
                      </div>
                      <label className="text-sm">
                        Postcode
                        <input
                          required
                          value={customer.postcode}
                          onChange={(e) => {
                            setCustomer({
                              ...customer,
                              postcode: e.target.value,
                            })
                            setDeliveryQuote(null)
                            setDeliveryFeeError('')
                          }}
                          autoComplete="postal-code"
                          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={checkDeliveryFee}
                          disabled={isCheckingDeliveryFee}
                          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
                        >
                          {isCheckingDeliveryFee
                            ? 'Checking address…'
                            : 'Check delivery fee'}
                        </button>
                        {deliveryQuote?.deliverable &&
                        deliveryQuote.currency === currency ? (
                          <p
                            aria-live="polite"
                            className="mt-3 text-sm text-foreground"
                          >
                            Delivery available:{' '}
                            {formatCurrency(deliveryQuote.fee, deliveryQuote.currency)} estimated fee
                            <span className="text-muted-foreground">
                              {' '}
                              · {deliveryQuote.distanceKm} km from the bakery
                            </span>
                          </p>
                        ) : null}
                        {deliveryFeeError ? (
                          <p role="alert" className="mt-3 text-sm text-destructive">
                            {deliveryFeeError}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs text-muted-foreground">
                          Address suggestions and delivery geocoding use
                          OpenStreetMap data. ©{' '}
                          <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                          >
                            OpenStreetMap contributors
                          </a>
                          .
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="rounded-xl bg-secondary p-4 text-sm leading-6 text-muted-foreground sm:col-span-2">
                      Studio collection address and contact details will be
                      included in your confirmation email.
                    </p>
                  )}
                  <label className="text-sm sm:col-span-2">
                    Inspiration photo
                    <div className="mt-2 rounded-xl border border-dashed border-border p-4">
                      {!referenceImage ? (
                        <>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={isUploadingReferenceImage}
                            onChange={(event) =>
                              uploadReferenceImage(event.target.files?.[0])
                            }
                            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-foreground"
                          />
                          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Upload />
                            JPG, PNG, or WebP · up to 2 MB
                          </p>
                        </>
                      ) : null}
                      {isUploadingReferenceImage ? (
                        <p role="status" className="mt-2 text-sm">
                          Uploading image…
                        </p>
                      ) : null}
                      {referenceImage ? (
                        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                          <div className="relative aspect-[4/3] max-h-80 bg-secondary">
                            <img
                              src={referenceImage.url}
                              alt={`Inspiration photo: ${referenceImage.name}`}
                              className="size-full object-contain"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 p-3">
                            <p className="min-w-0 truncate text-sm text-muted-foreground">
                              {referenceImage.name}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setReferenceImage(null)
                                setReferenceImageError('')
                              }}
                              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:border-destructive/40 hover:text-destructive"
                            >
                              <X aria-hidden="true" className="size-3.5" />
                              Remove photo
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {referenceImageError ? (
                        <p role="alert" className="mt-2 text-sm text-destructive">
                          {referenceImageError}
                        </p>
                      ) : null}
                    </div>
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Additional instructions
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-2 min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3"
                      placeholder="Colours, placement, message or anything else we should know..."
                    />
                  </label>
                </div>
              </Step>
            )}
            {step === 5 && (
              <Step
                title="Review your cake"
                subtitle="Check your order details, then pay the full total to submit it for studio review."
              >
                <div className="flex flex-col gap-3 text-sm">
                  {baseProductId ? (
                    <div className="rounded-xl bg-secondary p-4">
                      <strong>
                        {catalog.find((item) => item.id === baseProductId)
                          ?.name ?? category}
                      </strong>
                      <p className="mt-2 text-muted-foreground">
                        {catalog.find((item) => item.id === tiers[0]?.flavourId)
                          ?.name ?? ''}
                        {' · '}
                        {catalog.find((item) => item.id === tiers[0]?.frostingId)
                          ?.name ?? ''}
                        {' · '}
                        {catalog.find((item) => item.id === tiers[0]?.fillingId)
                          ?.name ?? ''}
                      </p>
                    </div>
                  ) : tiers.map((tier, i) => (
                    <div className="rounded-xl bg-secondary p-4" key={i}>
                      <div className="flex justify-between">
                        <strong>Tier {i + 1}</strong>
                        <span>from {formatTierPrice(tier.size, tier.layers)}</span>
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {tier.size}&quot; · {tier.layers} layers ·{' '}
                        {catalog.find((item) => item.id === tier.flavourId)?.name} ·{' '}
                        {catalog.find((item) => item.id === tier.frostingId)?.name} ·{' '}
                        {catalog.find((item) => item.id === tier.fillingId)?.name}
                      </p>
                    </div>
                  ))}
                  <p>
                    <strong>Finish:</strong> {colour}
                    {ombre && ` + ${secondColour} ombré`} · {design}
                  </p>
                  <p>
                    <strong>Toppings:</strong>{' '}
                    {selectedToppings
                      .map(
                        (id) =>
                          catalog.find((item) => item.id === id)?.name ?? '',
                      )
                      .filter(Boolean)
                      .join(', ') || 'None'}
                  </p>
                  <p>
                    <strong>Topper:</strong> {topper || 'None'}
                  </p>
                  {referenceImage ? (
                    <div className="overflow-hidden rounded-xl border border-border bg-secondary">
                      <div className="relative aspect-[4/3] max-h-80">
                        <img
                          src={referenceImage.url}
                          alt={`Inspiration photo: ${referenceImage.name}`}
                          className="size-full object-contain"
                        />
                      </div>
                      <p className="p-3 text-xs text-muted-foreground">
                        Inspiration photo · {referenceImage.name}
                      </p>
                    </div>
                  ) : null}
                  {notes.trim() ? (
                    <div className="rounded-xl bg-secondary p-4">
                      <strong>Additional instructions</strong>
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {notes.trim()}
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-xl bg-secondary p-4">
                    <p>
                      <strong>Customer:</strong>{' '}
                      {customer.name || 'Not entered'} ·{' '}
                      {customer.phone || 'Phone not entered'} ·{' '}
                      {customer.email || 'Email not entered'}
                    </p>
                    <p className="mt-2">
                      <strong>{customer.fulfillment}:</strong>{' '}
                      {customer.fulfillment === 'Delivery'
                        ? `${customer.address || 'Address not entered'}, ${customer.postcode || 'Postcode not entered'}`
                        : 'Studio collection; pickup address and contact will be included in confirmation'}
                    </p>
                    <p className="mt-2">
                      <strong>Preferred date:</strong>{' '}
                      {customer.date || 'Not selected'}
                    </p>
                  </div>
                  <div className="mt-4 rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span>Cake estimate</span>
                      <strong>
                        {formatAmount(subtotal)}
                      </strong>
                    </div>
                    {customer.fulfillment === 'Delivery' ? (
                      <div className="mt-2 flex items-center justify-between">
                        <span>Estimated delivery fee</span>
                        <strong>
                          {currentDeliveryQuote
                            ? formatCurrency(
                                currentDeliveryQuote.fee,
                                currentDeliveryQuote.currency,
                              )
                            : 'Check address'}
                        </strong>
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="font-medium">Your total</span>
                      <strong className="font-serif text-2xl">
                        {canShowTotal ? formatAmount(totalEstimate) : 'Check address'}
                      </strong>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 />
                      {customer.fulfillment === 'Delivery' && currentDeliveryQuote
                        ? `Delivery fee calculated for ${currentDeliveryQuote.distanceKm} km from the bakery.`
                        : customer.fulfillment === 'Delivery'
                          ? 'Check your address to calculate the delivery fee and total.'
                          : 'Collection selected; no delivery fee applies.'}
                    </p>
                  </div>
                </div>
              </Step>
            )}
            {submitError && (
              <p
                role="alert"
                className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}
            <div className="mt-8 flex justify-between border-t border-border pt-5">
              <button
                disabled={step === 0}
                onClick={() =>
                  setStep(baseProductId && step === 3 ? 0 : step - 1)
                }
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground disabled:opacity-30"
              >
                <ChevronLeft /> Back
              </button>
              {step < 5 ? (
                <button
                  onClick={() =>
                    setStep(step === 0 && baseProductId ? 3 : step + 1)
                  }
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
                >
                  Continue <ChevronRight />
                </button>
              ) : (
                <button
                  disabled={isSubmittingRequest || subtotal === null}
                  onClick={submitRequest}
                  className="rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {isSubmittingRequest ? 'Opening secure checkout…' : 'Pay full amount'}
                </button>
              )}
            </div>
          </div>
          <aside className="h-fit rounded-[1.5rem] bg-primary p-6 text-primary-foreground lg:sticky lg:top-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/85">
              Your total
            </p>
            <div className="mt-3 font-serif text-4xl">
              {canShowTotal ? formatAmount(totalEstimate) : '—'}
            </div>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {customer.fulfillment === 'Delivery' && !currentDeliveryQuote
                ? 'check address to calculate total'
                : customer.fulfillment === 'Delivery'
                  ? 'cake and delivery'
                  : 'cake total'}
            </p>
            <div className="my-6 h-px bg-primary-foreground/20" />
            <div className="flex flex-col gap-3 text-sm">
              <p className="flex justify-between">
                <span className="text-primary-foreground/85">Cake & details</span>
                <span>{formatAmount(subtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-primary-foreground/85">Delivery</span>
                <span>
                  {customer.fulfillment === 'Delivery'
                    ? currentDeliveryQuote
                      ? formatCurrency(
                          currentDeliveryQuote.fee,
                          currentDeliveryQuote.currency,
                        )
                      : 'Check address'
                    : 'Collection'}
                </span>
              </p>
            </div>
            <div className="mt-6 rounded-xl bg-primary-foreground/15 p-3 text-xs leading-5 text-primary-foreground/90">
              Delivery is available within {maxDeliveryKm} km. Check your address to calculate the delivery fee before requesting approval.
            </div>
            {subtotal === null ? (
              <p role="status" className="mt-4 text-xs leading-5 text-primary-foreground/90">
                The studio is setting up prices for this market. Cake requests
                will be available once NGN prices are configured.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  )
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <>
      <h3 className="font-serif text-3xl text-foreground">{title}</h3>
      <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
        {subtitle}
      </p>
      {children}
    </>
  )
}
function Choice({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean
  onClick: () => void
  title: string
  detail: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? 'border-primary bg-secondary' : 'border-border hover:border-primary/50'}`}
    >
      <span className="flex items-center justify-between font-medium">
        {title}
        {active && <Check className="size-4" />}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </button>
  )
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | number
  options: Array<string | { value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
      >
        {options.map((option) =>
          typeof option === 'string' ? (
            <option key={option} value={option}>
              {option}
            </option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

export function AdminPreview() {
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>(
    'pending',
  )
  const [note, setNote] = useState(
    'Your fully paid order is approved. We look forward to making it for you.',
  )
  const currency: Currency = 'NGN'
  return (
    <section
      id="admin"
      className="border-t border-border bg-card px-4 py-16 md:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Studio admin
            </p>
            <h2 className="mt-3 font-serif text-4xl">Review & approve</h2>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
            Demo dashboard
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">Ariana&apos;s birthday cake</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New request · 24 October 2026
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {decision === 'approved'
                  ? 'Confirmed'
                  : decision === 'rejected'
                    ? 'Refund requested'
                    : 'Paid · awaiting review'}
              </span>
            </div>
            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Cake estimate</span>
                <br />
                <strong>{formatCurrency(168, currency)}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Delivery</span>
                <br />
                <strong>
                  {formatCurrency(12, currency)} · included in payment
                </strong>
              </p>
            </div>
            <div className="mt-6 rounded-xl bg-secondary p-4 text-sm leading-6">
              6&quot; · 3 layers · Red velvet
              <br />
              Russian buttercream · Blush + lilac ombré
              <br />
              Piped florals · Happy Birthday
            </div>
          </div>
          <div className="rounded-2xl bg-secondary p-5">
            <p className="font-medium">
              {decision === 'approved'
                ? 'Approval email sent'
                : decision === 'rejected'
                  ? 'Refund requested'
                  : 'Payment confirmed'}
            </p>
            {decision !== 'pending' ? (
              <>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {decision === 'approved'
                    ? 'Ariana receives the approval email and the order moves to Cake confirmations.'
                    : 'A full refund to Ariana’s original payment method has been requested.'}
                </p>
                <button
                  onClick={() => setDecision('pending')}
                  className="mt-5 rounded-full border border-border px-4 py-2 text-sm"
                >
                  Reset demo
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  The full cake and delivery total is already paid. Approve with
                  a note or reject and request a full refund.
                </p>
                <label className="mt-4 block text-sm">
                  Approval note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-3"
                  />
                </label>
                <button
                  onClick={() => setDecision('approved')}
                  className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
                >
                  Approve order
                </button>
                <button
                  onClick={() => setDecision('rejected')}
                  className="mt-2 w-full rounded-full border border-border px-4 py-3 text-sm font-medium"
                >
                  Reject & request refund
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function BuilderNav() {
  return null
}

export { ImagePlus, Minus, Plus, Sparkles, X }
