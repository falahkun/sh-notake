CREATE TABLE IF NOT EXISTS "shared_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "share_id" text NOT NULL UNIQUE,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz
);
