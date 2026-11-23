ALTER TABLE "cake_requests"
  ADD COLUMN IF NOT EXISTS "payment_reference" text,
  ADD COLUMN IF NOT EXISTS "payment_email_sent_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "approval_note" text,
  ADD COLUMN IF NOT EXISTS "rejection_note" text,
  ADD COLUMN IF NOT EXISTS "refund_reference" text;

ALTER TABLE "cake_requests"
  ADD CONSTRAINT "cake_requests_payment_reference_unique"
  UNIQUE ("payment_reference");
