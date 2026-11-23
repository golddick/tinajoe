ALTER TABLE public.studio_admin
  DROP CONSTRAINT IF EXISTS studio_admin_singleton_id_check;

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id text NOT NULL
    REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  accepted_user_id text UNIQUE
    REFERENCES neon_auth."user"(id) ON DELETE RESTRICT
);
