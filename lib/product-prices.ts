import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { productCatalog, productPrices } from '@/lib/db/schema'
import {
  type Currency,
  type CurrencyPriceMap,
  isCurrency,
  isProductKind,
  type ProductCatalogItem,
} from '@/lib/pricing-catalog'

export async function getProductPriceCatalog(): Promise<{
  catalog: ProductCatalogItem[]
  prices: CurrencyPriceMap
}> {
  const [catalogRows, priceRows] = await Promise.all([
    db
      .select({
        id: productCatalog.id,
        name: productCatalog.name,
        category: productCatalog.category,
        kind: productCatalog.kind,
      })
      .from(productCatalog)
      .where(eq(productCatalog.active, true))
      .orderBy(asc(productCatalog.sortOrder), asc(productCatalog.name)),
    db
    .select({
      productId: productPrices.productId,
      currency: productPrices.currency,
      amount: productPrices.amount,
    })
    .from(productPrices)
  ])

  const catalog: ProductCatalogItem[] = catalogRows.flatMap((row) =>
    isProductKind(row.kind) && row.name.trim() && row.category.trim()
      ? [{
          id: row.id,
          name: row.name,
          category: row.category,
          kind: row.kind,
        }]
      : [],
  )

  const prices: CurrencyPriceMap = {}
  for (const row of priceRows) {
    if (!isCurrency(row.currency)) continue
    const currency: Currency = row.currency
    const amount = Number(row.amount)
    if (!Number.isFinite(amount)) continue
    prices[row.productId] ??= {}
    prices[row.productId][currency] = amount
  }
  return { catalog, prices }
}
