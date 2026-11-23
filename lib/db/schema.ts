import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  index,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { dropid } from 'dropid'

const neonAuth = pgSchema('neon_auth')

export const user = neonAuth.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = neonAuth.table('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = neonAuth.table('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = neonAuth.table('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
})

export const authSchema = { user, session, account, verification }

export const studioAdmin = pgTable(
  'studio_admin',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'restrict' }),
  },
)

export const adminInvitations = pgTable(
  'admin_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => dropid('admin_invite')),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedUserId: text('accepted_user_id')
      .unique()
      .references(() => user.id, { onDelete: 'restrict' }),
  },
)

export const deliverySettings = pgTable('delivery_settings', {
  id: text('id').primaryKey(),
  flatFee: numeric('flat_fee', { precision: 12, scale: 2 }).notNull(),
  studioEmail: text('studio_email').notNull().default('hello@crumb.studio'),
  studioPhone: text('studio_phone').notNull().default('+44 7700 900000'),
  bakeryAddress: text('bakery_address'),
  bakeryLatitude: numeric('bakery_latitude', { precision: 10, scale: 7 }),
  bakeryLongitude: numeric('bakery_longitude', { precision: 10, scale: 7 }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const deliveryPrices = pgTable(
  'delivery_prices',
  {
    currency: text('currency').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    perKmAmount: numeric('per_km_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'delivery_prices_currency_pk',
      columns: [table.currency],
    }),
    check('delivery_prices_currency_check', sql`${table.currency} in ('NGN', 'EUR', 'USD')`),
    check('delivery_prices_amount_nonnegative', sql`${table.amount} >= 0`),
    check('delivery_prices_per_km_amount_nonnegative', sql`${table.perKmAmount} >= 0`),
  ],
)

export const geocodingCache = pgTable('geocoding_cache', {
  addressHash: text('address_hash').primaryKey(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const geocodingServiceState = pgTable('geocoding_service_state', {
  id: text('id').primaryKey(),
  lastRequestAt: timestamp('last_request_at', { withTimezone: true }).notNull(),
})

export const blockedDates = pgTable('blocked_dates', {
  date: date('date').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const productCatalog = pgTable(
  'product_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    kind: text('kind').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'product_catalog_kind_check',
      sql`${table.kind} in ('cake_size', 'extra_layer', 'extra_tier', 'flavour', 'frosting', 'filling', 'topping', 'package', 'base_product')`,
    ),
    index('product_catalog_category_kind_idx').on(table.category, table.kind),
  ],
)

export const productPrices = pgTable(
  'product_prices',
  {
    productId: text('product_id')
      .notNull()
      .references(() => productCatalog.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'product_prices_product_id_currency_pk',
      columns: [table.productId, table.currency],
    }),
    check('product_prices_currency_check', sql`${table.currency} in ('NGN', 'EUR', 'USD')`),
    check('product_prices_amount_nonnegative', sql`${table.amount} >= 0`),
  ],
)

export const galleryCategories = pgTable(
  'gallery_categories',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => dropid('gallery_category')),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('gallery_categories_name_unique').on(table.name),
  ],
)

export const galleryItems = pgTable(
  'gallery_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => dropid('gallery_item')),
    categoryId: text('category_id')
      .notNull()
      .references(() => galleryCategories.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    imageId: text('image_id').notNull(),
    imageUrl: text('image_url').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('gallery_items_active_created_at_idx').on(
      table.active,
      table.createdAt,
    ),
    index('gallery_items_category_id_idx').on(table.categoryId),
  ],
)

export type CakeTier = {
  size: number
  layers: number
  flavour: string
  flavourId?: string
  frosting: string
  frostingId?: string
  filling: string
  fillingId?: string
}

export type CakeDesign = {
  colour: string
  secondColour: string
  ombre: boolean
  design: string
  toppings: string[]
  toppingIds?: string[]
  baseProductId?: string | null
  baseProductName?: string
  topper: string
  notes: string
}

export const customers = pgTable('customers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => dropid('customer')),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const cakeRequests = pgTable('cake_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => dropid('cake_request')),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  category: text('category').notNull(),
  preferredDate: date('preferred_date').notNull(),
  fulfillment: text('fulfillment').notNull(),
  deliveryAddress: text('delivery_address'),
  deliveryPostcode: text('delivery_postcode'),
  deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }),
  deliveryDistanceKm: numeric('delivery_distance_km', {
    precision: 8,
    scale: 2,
  }),
  cakeEstimate: numeric('cake_estimate', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('NGN'),
  status: text('status').notNull().default('new_request'),
  paymentStatus: text('payment_status').notNull().default('not_sent'),
  paymentReference: text('payment_reference').unique(),
  paymentEmailSentAt: timestamp('payment_email_sent_at', {
    withTimezone: true,
  }),
  adminNotificationSentAt: timestamp('admin_notification_sent_at', {
    withTimezone: true,
  }),
  approvalNote: text('approval_note'),
  rejectionNote: text('rejection_note'),
  refundReference: text('refund_reference'),
  design: jsonb('design').$type<CakeDesign>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index('cake_requests_status_created_at_idx').on(table.status, table.createdAt),
  index('cake_requests_customer_id_idx').on(table.customerId),
])

export const cakeRequestTiers = pgTable('cake_request_tiers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => dropid('cake_tier')),
  requestId: text('request_id')
    .notNull()
    .references(() => cakeRequests.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  size: integer('size').notNull(),
  layers: integer('layers').notNull(),
  flavour: text('flavour').notNull(),
  frosting: text('frosting').notNull(),
  filling: text('filling').notNull(),
}, (table) => [
  unique('cake_request_tiers_request_position_unique').on(
    table.requestId,
    table.position,
  ),
  index('cake_request_tiers_request_id_idx').on(table.requestId),
])

export const cakeRequestFiles = pgTable('cake_request_files', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => dropid('cake_file')),
  requestId: text('request_id')
    .notNull()
    .references(() => cakeRequests.id, { onDelete: 'cascade' }),
  dropaphiFileId: text('dropaphi_file_id').notNull().unique(),
  url: text('url').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index('cake_request_files_request_id_idx').on(table.requestId),
])
