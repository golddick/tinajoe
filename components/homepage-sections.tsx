'use client'

import { ArrowUpRight, Camera, Mail, MapPin, Phone, Star } from 'lucide-react'
import { useStorefrontPricing } from '@/components/storefront-pricing-provider'
import {
  GalleryCardRotator,
  type PublicGalleryItem,
} from '@/components/gallery-card-rotator'

type CollectionCardProps = {
  title: string
  detail: string
  productId: string
  tone: string
}

export function HeroSection() {
  return (
    <section
      id="top"
      className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-8 md:grid-cols-[1fr_0.9fr] md:items-center md:px-10 md:pb-28 md:pt-14"
    >
      <div>
        <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-accent-foreground"
          />
          Made for your moment
        </p>
        <h1 className="max-w-xl font-serif text-5xl leading-[0.96] tracking-tight sm:text-6xl md:text-8xl md:leading-[0.92]">
          A little <em className="text-accent-foreground">extraordinary.</em>
        </h1>
        <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground">
          Modern celebration cakes, thoughtfully made in our kitchen. Designed by you, finished by us.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#builder"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Build your cake <ArrowUpRight aria-hidden="true" />
          </a>
          <a
            href="#cakes"
            className="rounded-full border border-border px-5 py-3 text-sm"
          >
            Explore the collection
          </a>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:mt-12">
          <div
            aria-label="Rated five out of five stars"
            className="flex text-accent-foreground"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                aria-hidden="true"
                className="size-4 fill-current"
              />
            ))}
          </div>
          <span>5.0 from 120+ celebrations</span>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-xl md:max-w-none">
        <div className="overflow-hidden rounded-[2rem] bg-secondary">
          <img
            src="/cake-hero.png"
            alt="Blush and lilac ombré celebration cake"
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
        <div className="absolute -bottom-5 left-3 rounded-2xl bg-card p-4 shadow-lg sm:left-5 md:-left-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Next available
          </p>
          <p className="mt-1 font-serif text-lg sm:text-xl">October 24, 2026</p>
        </div>
      </div>
    </section>
  )
}

export function CollectionSection() {
  return (
    <section
      id="cakes"
      className="border-y border-border bg-secondary/50 px-5 py-16 md:px-10 md:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              A starting point
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">
              Made for the occasion
            </h2>
          </div>
          <a
            href="#builder"
            className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
          >
            See all options <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <CollectionCard
            title="The birthday edit"
            detail="Piped florals · velvet ribbons"
            productId="package_birthday_edit"
            tone="bg-accent"
          />
          <CollectionCard
            title="Little celebrations"
            detail="Characters · names · tiny details"
            productId="package_little_celebrations"
            tone="bg-muted"
          />
          <CollectionCard
            title="The custom piece"
            detail="Your idea, brought to life"
            productId="package_custom_piece"
            tone="bg-card"
          />
        </div>
      </div>
    </section>
  )
}

function CollectionCard({ title, detail, productId, tone }: CollectionCardProps) {
  const { formatPrice } = useStorefrontPricing()
  return (
    <a
      href="#builder"
      className={`group min-h-64 rounded-3xl ${tone} p-5 transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <div className="flex h-full flex-col justify-between gap-8">
        <div className="flex justify-end">
          <ArrowUpRight
            aria-hidden="true"
            className="transition group-hover:translate-x-1 group-hover:-translate-y-1"
          />
        </div>
        <div>
          <h3 className="font-serif text-3xl">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          <p className="mt-5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            from {formatPrice(productId)}{' '}
            <span className="normal-case tracking-normal">
            · delivery added at checkout
            </span>
          </p>
        </div>
      </div>
    </a>
  )
}

export function GallerySection({ items }: { items: PublicGalleryItem[] }) {
  return (
    <section
      id="gallery"
      className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 md:flex-row md:items-center md:px-10 md:py-24"
    >
      <div className="flex-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          From the gallery
        </p>
        <h2 className="mt-3 max-w-md font-serif text-4xl md:text-5xl">
          The details make the day.
        </h2>
        <p className="mt-5 max-w-md leading-7 text-muted-foreground">
          Follow along for fresh inspiration, seasonal flavours and a peek
          behind the scenes.
        </p>
        <a
          href="#builder"
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm"
        >
          Visit Instagram <Camera aria-hidden="true" />
        </a>
      </div>
      <GalleryCardRotator items={items} />
    </section>
  )
}

export function SiteFooter({
  studioEmail,
  studioPhone,
}: {
  studioEmail: string
  studioPhone: string
}) {
  return (
    <footer className="bg-primary px-5 py-12 text-primary-foreground md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 sm:flex-row">
        <div>
          <p className="font-serif text-3xl">crumb.studio</p>
          <p className="mt-3 max-w-xs text-sm leading-6 text-primary-foreground/90">
            Thoughtful cakes for life&apos;s sweetest chapters.
          </p>
        </div>
        <address className="flex flex-col gap-3 text-sm not-italic text-primary-foreground/90">
          <p className="flex items-center gap-2">
            <MapPin aria-hidden="true" /> South London, UK
          </p>
          <a
            className="flex items-center gap-2 hover:underline"
            href={`mailto:${studioEmail}`}
          >
            <Mail aria-hidden="true" /> {studioEmail}
          </a>
          <a
            className="flex items-center gap-2 hover:underline"
            href={`tel:${studioPhone.replace(/[^\d+]/g, '')}`}
          >
            <Phone aria-hidden="true" /> {studioPhone}
          </a>
        </address>
      </div>
    </footer>
  )
}
