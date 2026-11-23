'use client'

import { useState } from 'react'
import { Camera, Menu, X } from 'lucide-react'
import { CurrencySelector } from '@/components/storefront-pricing-provider'

const navigationLinks = [
  { href: '#cakes', label: 'The collection' },
  { href: '#builder', label: 'Build your cake' },
  { href: '/admin', label: 'For the studio' },
]

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
      <a href="#top" className="font-serif text-2xl tracking-tight">
        TINA<span className="text-accent-foreground">.</span>JOE
      </a>

      <nav
        aria-label="Main navigation"
        className="hidden items-center gap-8 text-sm md:flex"
      >
        {navigationLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-muted-foreground transition hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <CurrencySelector />
        {/* <a
          aria-label="Instagram gallery"
          href="#gallery"
          className="hidden rounded-full border border-border p-2 md:block"
        >
          <Camera aria-hidden="true" />
        </a> */}
        <a
          href="#builder"
          className="rounded-full hidden md:block bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start building
        </a>
        <button
          type="button"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-full border border-border p-2 md:hidden"
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {isMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="absolute inset-x-4 top-[calc(100%-0.25rem)] flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-lg md:hidden"
        >
          {navigationLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="rounded-xl px-4 py-3 text-sm text-foreground hover:bg-secondary"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
