ALTER TABLE "delivery_settings"
  ADD COLUMN IF NOT EXISTS "studio_email" text NOT NULL DEFAULT 'hello@crumb.studio',
  ADD COLUMN IF NOT EXISTS "studio_phone" text NOT NULL DEFAULT '+44 7700 900000';
