CREATE TABLE IF NOT EXISTS "blocked_dates" (
  "date" date PRIMARY KEY,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
