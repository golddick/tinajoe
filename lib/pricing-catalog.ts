export const SUPPORTED_CURRENCIES = ['NGN', 'EUR', 'USD'] as const

export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

export const DEFAULT_CURRENCY: Currency = 'NGN'

export const PRODUCT_KINDS = [
  'cake_size',
  'extra_layer',
  'extra_tier',
  'flavour',
  'frosting',
  'filling',
  'topping',
  'package',
  'base_product',
] as const

export type ProductKind = (typeof PRODUCT_KINDS)[number]

export type ProductCatalogItem = {
  id: string
  name: string
  category: string
  kind: ProductKind
}

export const DEFAULT_PRODUCT_CATALOG: ProductCatalogItem[] = [
  ...Array.from({ length: 9 }, (_, index) => {
    const size = index + 4
    return {
      id: `cake_size_${size}`,
      name: `${size} inch cake · 2 layers`,
      category: 'Cake sizes',
      kind: 'cake_size' as const,
    }
  }),
  { id: 'extra_layer', name: 'Each extra cake layer', category: 'Cake options', kind: 'extra_layer' },
  { id: 'extra_tier', name: 'Each additional tier', category: 'Cake options', kind: 'extra_tier' },
  { id: 'flavour_vanilla_bean', name: 'Vanilla bean', category: 'Flavours', kind: 'flavour' },
  { id: 'flavour_chocolate_fudge', name: 'Chocolate fudge', category: 'Flavours', kind: 'flavour' },
  { id: 'flavour_red_velvet', name: 'Red velvet', category: 'Flavours', kind: 'flavour' },
  {
    id: 'flavour_lemon_elderflower',
    name: 'Lemon & elderflower',
    category: 'Flavours',
    kind: 'flavour',
  },
  { id: 'frosting_whipped_cream', name: 'Whipped cream', category: 'Frostings', kind: 'frosting' },
  {
    id: 'frosting_russian_buttercream',
    name: 'Russian buttercream',
    category: 'Frostings',
    kind: 'frosting',
  },
  {
    id: 'frosting_chocolate_ganache',
    name: 'Chocolate ganache',
    category: 'Frostings',
    kind: 'frosting',
  },
  { id: 'frosting_fondant', name: 'Fondant', category: 'Frostings', kind: 'frosting' },
  {
    id: 'filling_vanilla_buttercream',
    name: 'Vanilla buttercream',
    category: 'Fillings',
    kind: 'filling',
  },
  {
    id: 'filling_chocolate_truffle',
    name: 'Chocolate truffle',
    category: 'Fillings',
    kind: 'filling',
  },
  {
    id: 'filling_raspberry_compote',
    name: 'Raspberry compote',
    category: 'Fillings',
    kind: 'filling',
  },
  { id: 'filling_lemon_curd', name: 'Lemon curd', category: 'Fillings', kind: 'filling' },
  {
    id: 'topping_fresh_strawberries',
    name: 'Fresh strawberries',
    category: 'Toppings',
    kind: 'topping',
  },
  { id: 'topping_chocolate_drip', name: 'Chocolate drip', category: 'Toppings', kind: 'topping' },
  { id: 'topping_macarons', name: 'Macarons', category: 'Toppings', kind: 'topping' },
  { id: 'topping_piped_florals', name: 'Piped florals', category: 'Toppings', kind: 'topping' },
  { id: 'topping_gold_leaf', name: 'Gold leaf', category: 'Toppings', kind: 'topping' },
  { id: 'topping_cookies', name: 'Cookies', category: 'Toppings', kind: 'topping' },
  {
    id: 'package_birthday_edit',
    name: 'The birthday edit · from',
    category: 'Collection cards',
    kind: 'package',
  },
  {
    id: 'package_little_celebrations',
    name: 'Little celebrations · from',
    category: 'Collection cards',
    kind: 'package',
  },
  {
    id: 'package_custom_piece',
    name: 'The custom piece · from',
    category: 'Collection cards',
    kind: 'package',
  },
]

export type ProductPriceItem = ProductCatalogItem
export type CurrencyPriceMap = Record<string, Partial<Record<Currency, number>>>

const euroCountries = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
])

export function isCurrency(value: unknown): value is Currency {
  return SUPPORTED_CURRENCIES.includes(value as Currency)
}

export function currencyForCountry(country: string | null | undefined): Currency {
  const code = country?.trim().toUpperCase()
  if (code === 'US') return 'USD'
  if (code && euroCountries.has(code)) return 'EUR'
  return DEFAULT_CURRENCY
}

export function storefrontCurrency(
  preferred: Currency,
  prices: CurrencyPriceMap,
  catalog: ProductCatalogItem[] = DEFAULT_PRODUCT_CATALOG,
): Currency | null {
  const isComplete = (currency: Currency) =>
    catalog.every(
      (item) => prices[item.id]?.[currency] !== undefined,
    )

  if (isComplete(preferred)) return preferred
  if (preferred !== DEFAULT_CURRENCY && isComplete(DEFAULT_CURRENCY)) {
    return DEFAULT_CURRENCY
  }
  return null
}

export function isProductKind(value: unknown): value is ProductKind {
  return PRODUCT_KINDS.includes(value as ProductKind)
}

export function productKindLabel(kind: ProductKind) {
  const labels: Record<ProductKind, string> = {
    cake_size: 'Cake size',
    extra_layer: 'Extra cake layer',
    extra_tier: 'Extra tier',
    flavour: 'Flavour',
    frosting: 'Frosting',
    filling: 'Filling',
    topping: 'Topping',
    package: 'Featured collection price',
    base_product: 'Standalone product',
  }
  return labels[kind]
}

export function formatCurrency(amount: number, currency: Currency) {
  const locales: Record<Currency, string> = {
    NGN: 'en-NG',
    EUR: 'en-IE',
    USD: 'en-US',
  }
  return new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function productIdForOption(
  group: 'flavour' | 'frosting' | 'filling' | 'topping',
  name: string,
) {
  const slug = name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${group}_${slug}`
}
