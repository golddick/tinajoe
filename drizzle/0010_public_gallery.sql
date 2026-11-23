CREATE TABLE IF NOT EXISTS "gallery_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "gallery_items" (
  "id" text PRIMARY KEY NOT NULL,
  "category_id" text NOT NULL REFERENCES "gallery_categories"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "image_id" text NOT NULL,
  "image_url" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gallery_items_active_created_at_idx"
  ON "gallery_items" ("active", "created_at");
CREATE INDEX IF NOT EXISTS "gallery_items_category_id_idx"
  ON "gallery_items" ("category_id");
