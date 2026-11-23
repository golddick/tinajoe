CREATE TABLE IF NOT EXISTS "delivery_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "flat_fee" numeric(12, 2) NOT NULL,
  "bakery_address" text,
  "bakery_latitude" numeric(10, 7),
  "bakery_longitude" numeric(10, 7),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "delivery_settings"
  ADD COLUMN IF NOT EXISTS "bakery_address" text,
  ADD COLUMN IF NOT EXISTS "bakery_latitude" numeric(10, 7),
  ADD COLUMN IF NOT EXISTS "bakery_longitude" numeric(10, 7);

CREATE TABLE IF NOT EXISTS "geocoding_cache" (
  "address_hash" text PRIMARY KEY NOT NULL,
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "geocoding_cache_coordinates_pair_check"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);

CREATE INDEX IF NOT EXISTS "geocoding_cache_created_at_idx"
  ON "geocoding_cache" ("created_at");

CREATE TABLE IF NOT EXISTS "geocoding_service_state" (
  "id" text PRIMARY KEY NOT NULL,
  "last_request_at" timestamptz NOT NULL
);
