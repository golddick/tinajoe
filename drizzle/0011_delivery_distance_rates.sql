ALTER TABLE "delivery_prices"
  ADD COLUMN IF NOT EXISTS "per_km_amount" numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE "delivery_prices"
  DROP CONSTRAINT IF EXISTS "delivery_prices_per_km_amount_nonnegative";

ALTER TABLE "delivery_prices"
  ADD CONSTRAINT "delivery_prices_per_km_amount_nonnegative"
  CHECK ("per_km_amount" >= 0);
