CREATE TABLE IF NOT EXISTS "customers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "phone" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cake_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "category" text NOT NULL,
  "preferred_date" date NOT NULL,
  "fulfillment" text NOT NULL CHECK ("fulfillment" IN ('Collection', 'Delivery')),
  "delivery_address" text,
  "delivery_postcode" text,
  "delivery_fee" numeric(12, 2),
  "delivery_distance_km" numeric(8, 2),
  "cake_estimate" numeric(12, 2) NOT NULL,
  "status" text NOT NULL DEFAULT 'new_request',
  "payment_status" text NOT NULL DEFAULT 'not_sent',
  "design" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cake_request_tiers" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL REFERENCES "cake_requests"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "size" integer NOT NULL,
  "layers" integer NOT NULL,
  "flavour" text NOT NULL,
  "frosting" text NOT NULL,
  "filling" text NOT NULL,
  CONSTRAINT "cake_request_tiers_request_position_unique" UNIQUE ("request_id", "position")
);

CREATE TABLE IF NOT EXISTS "cake_request_files" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL REFERENCES "cake_requests"("id") ON DELETE CASCADE,
  "dropaphi_file_id" text NOT NULL UNIQUE,
  "url" text NOT NULL,
  "name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cake_requests_status_created_at_idx"
  ON "cake_requests" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "cake_requests_customer_id_idx"
  ON "cake_requests" ("customer_id");
CREATE INDEX IF NOT EXISTS "cake_request_tiers_request_id_idx"
  ON "cake_request_tiers" ("request_id");
CREATE INDEX IF NOT EXISTS "cake_request_files_request_id_idx"
  ON "cake_request_files" ("request_id");
