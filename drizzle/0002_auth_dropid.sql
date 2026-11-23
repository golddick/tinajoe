CREATE SCHEMA IF NOT EXISTS neon_auth;

CREATE TABLE IF NOT EXISTS neon_auth."user" (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neon_auth.session (
  id text PRIMARY KEY NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL
);

CREATE TABLE IF NOT EXISTS neon_auth.account (
  id text PRIMARY KEY NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neon_auth.verification (
  id text PRIMARY KEY NOT NULL,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

BEGIN;

DO $$
DECLARE
  foreign_key RECORD;
BEGIN
  FOR foreign_key IN
    SELECT table_name.relname AS table_name, constraint_row.conname AS constraint_name
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS table_name ON table_name.oid = constraint_row.conrelid
    JOIN pg_namespace AS table_schema ON table_schema.oid = table_name.relnamespace
    JOIN pg_class AS referenced_table
      ON referenced_table.oid = constraint_row.confrelid
    JOIN pg_namespace AS referenced_schema
      ON referenced_schema.oid = referenced_table.relnamespace
    WHERE constraint_row.contype = 'f'
      AND referenced_schema.nspname = 'neon_auth'
      AND referenced_table.relname = 'user'
      AND table_schema.nspname = 'neon_auth'
      AND table_name.relname IN ('session', 'account')
      AND EXISTS (
        SELECT 1
        FROM unnest(constraint_row.conkey) AS key_column(attnum)
        JOIN pg_attribute AS column_info
          ON column_info.attrelid = constraint_row.conrelid
          AND column_info.attnum = key_column.attnum
        WHERE column_info.attname = 'userId'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE neon_auth.%I DROP CONSTRAINT %I',
      foreign_key.table_name,
      foreign_key.constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE neon_auth."user"
  ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE neon_auth.session
  ALTER COLUMN id TYPE text USING id::text,
  ALTER COLUMN "userId" TYPE text USING "userId"::text;
ALTER TABLE neon_auth.account
  ALTER COLUMN id TYPE text USING id::text,
  ALTER COLUMN "userId" TYPE text USING "userId"::text;
ALTER TABLE neon_auth.verification
  ALTER COLUMN id TYPE text USING id::text;

ALTER TABLE neon_auth.session
  ADD CONSTRAINT session_userId_user_id_fk
  FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;
ALTER TABLE neon_auth.account
  ADD CONSTRAINT account_userId_user_id_fk
  FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;

COMMIT;
