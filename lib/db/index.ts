import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  account,
  adminInvitations,
  blockedDates,
  cakeRequestFiles,
  cakeRequests,
  cakeRequestTiers,
  customers,
  deliveryPrices,
  deliverySettings,
  galleryCategories,
  galleryItems,
  geocodingCache,
  geocodingServiceState,
  productCatalog,
  productPrices,
  session,
  studioAdmin,
  user,
  verification,
} from './schema'

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool
}

export const pool =
  globalForPostgres.postgresPool ??
  new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresPool = pool
}

export const db = drizzle(pool, {
  schema: {
    account,
    adminInvitations,
    blockedDates,
    cakeRequestFiles,
    cakeRequests,
    cakeRequestTiers,
    customers,
    deliveryPrices,
    deliverySettings,
    galleryCategories,
    galleryItems,
    geocodingCache,
    geocodingServiceState,
    productCatalog,
    productPrices,
    session,
    studioAdmin,
    user,
    verification,
  },
})
