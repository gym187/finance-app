-- Add alert tracking columns to Budget table
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "alerted80" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "alerted100" BOOLEAN NOT NULL DEFAULT false;
