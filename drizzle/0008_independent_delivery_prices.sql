CREATE TABLE IF NOT EXISTS "delivery_prices" (
  "currency" text PRIMARY KEY CHECK ("currency" IN ('NGN', 'EUR', 'USD')),
  "amount" numeric(12, 2) NOT NULL CHECK ("amount" >= 0),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
