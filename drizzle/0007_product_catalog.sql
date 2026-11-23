CREATE TABLE IF NOT EXISTS "product_catalog" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "kind" text NOT NULL CHECK (
    "kind" IN (
      'cake_size',
      'extra_layer',
      'extra_tier',
      'flavour',
      'frosting',
      'filling',
      'topping',
      'package',
      'base_product'
    )
  ),
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "product_catalog_category_kind_idx"
  ON "product_catalog" ("category", "kind");

INSERT INTO "product_catalog" ("id", "name", "category", "kind", "sort_order")
SELECT
  'cake_size_' || size::text,
  size::text || ' inch cake · 2 layers',
  'Cake sizes',
  'cake_size',
  size
FROM generate_series(4, 12) AS size
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "product_catalog" ("id", "name", "category", "kind", "sort_order")
VALUES
  ('extra_layer', 'Each extra cake layer', 'Cake options', 'extra_layer', 1),
  ('extra_tier', 'Each additional tier', 'Cake options', 'extra_tier', 2),
  ('flavour_vanilla_bean', 'Vanilla bean', 'Flavours', 'flavour', 1),
  ('flavour_chocolate_fudge', 'Chocolate fudge', 'Flavours', 'flavour', 2),
  ('flavour_red_velvet', 'Red velvet', 'Flavours', 'flavour', 3),
  ('flavour_lemon_elderflower', 'Lemon & elderflower', 'Flavours', 'flavour', 4),
  ('frosting_whipped_cream', 'Whipped cream', 'Frostings', 'frosting', 1),
  ('frosting_russian_buttercream', 'Russian buttercream', 'Frostings', 'frosting', 2),
  ('frosting_chocolate_ganache', 'Chocolate ganache', 'Frostings', 'frosting', 3),
  ('frosting_fondant', 'Fondant', 'Frostings', 'frosting', 4),
  ('filling_vanilla_buttercream', 'Vanilla buttercream', 'Fillings', 'filling', 1),
  ('filling_chocolate_truffle', 'Chocolate truffle', 'Fillings', 'filling', 2),
  ('filling_raspberry_compote', 'Raspberry compote', 'Fillings', 'filling', 3),
  ('filling_lemon_curd', 'Lemon curd', 'Fillings', 'filling', 4),
  ('topping_fresh_strawberries', 'Fresh strawberries', 'Toppings', 'topping', 1),
  ('topping_chocolate_drip', 'Chocolate drip', 'Toppings', 'topping', 2),
  ('topping_macarons', 'Macarons', 'Toppings', 'topping', 3),
  ('topping_piped_florals', 'Piped florals', 'Toppings', 'topping', 4),
  ('topping_gold_leaf', 'Gold leaf', 'Toppings', 'topping', 5),
  ('topping_cookies', 'Cookies', 'Toppings', 'topping', 6),
  ('package_birthday_edit', 'The birthday edit · from', 'Collection cards', 'package', 1),
  ('package_little_celebrations', 'Little celebrations · from', 'Collection cards', 'package', 2),
  ('package_custom_piece', 'The custom piece · from', 'Collection cards', 'package', 3)
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_prices_product_id_fk'
      AND conrelid = 'public.product_prices'::regclass
  ) THEN
    ALTER TABLE "product_prices"
      ADD CONSTRAINT "product_prices_product_id_fk"
      FOREIGN KEY ("product_id")
      REFERENCES "product_catalog" ("id")
      ON DELETE CASCADE;
  END IF;
END
$$;
