ALTER TABLE "cake_requests"
  ADD COLUMN IF NOT EXISTS "admin_notification_sent_at" timestamptz;
