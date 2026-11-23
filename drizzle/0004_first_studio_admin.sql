CREATE TABLE IF NOT EXISTS public.studio_admin (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL UNIQUE
    REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  CONSTRAINT studio_admin_singleton_id_check CHECK (id = 'primary')
);

INSERT INTO public.studio_admin (id, user_id)
SELECT 'primary', id
FROM neon_auth."user"
WHERE "emailVerified" = true
ORDER BY "createdAt", id
LIMIT 1
ON CONFLICT (id) DO NOTHING;
