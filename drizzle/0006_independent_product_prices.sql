CREATE TABLE IF NOT EXISTS "product_prices" (
  "product_id" text NOT NULL,
  "currency" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_prices_product_id_currency_pk"
    PRIMARY KEY ("product_id", "currency"),
  CONSTRAINT "product_prices_currency_check"
    CHECK ("currency" IN ('NGN', 'EUR', 'USD')),
  CONSTRAINT "product_prices_amount_nonnegative"
    CHECK ("amount" >= 0)
);

ALTER TABLE "cake_requests"
  ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'GBP';
