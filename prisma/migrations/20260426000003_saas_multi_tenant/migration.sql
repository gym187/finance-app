-- Enums
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Plan
CREATE TABLE IF NOT EXISTS "Plan" (
  "id"          SERIAL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "price"       DECIMAL(65,30) NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "trialDays"   INTEGER NOT NULL DEFAULT 14,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_slug_key" ON "Plan"("slug");

INSERT INTO "Plan" ("name", "slug", "description", "price", "trialDays")
VALUES ('Pro', 'pro', 'Acesso completo à plataforma', 29.90, 14)
ON CONFLICT ("slug") DO NOTHING;

-- Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL,
  "planId"    INTEGER NOT NULL,
  "status"    "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate"   TIMESTAMP(3),
  "trialEnd"  TIMESTAMP(3),
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_userId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_planId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON UPDATE CASCADE;
  END IF;
END $$;

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         SERIAL PRIMARY KEY,
  "adminId"    INTEGER NOT NULL,
  "action"     TEXT NOT NULL,
  "targetId"   INTEGER,
  "targetType" TEXT,
  "details"    JSONB,
  "ip"         TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_adminId_idx" ON "AuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_adminId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON UPDATE CASCADE;
  END IF;
END $$;

-- User new columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "document" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyName" TEXT;

-- Existing users get ACTIVE subscription
INSERT INTO "Subscription" ("userId", "planId", "status")
SELECT u."id", p."id", 'ACTIVE'
FROM "User" u
CROSS JOIN (SELECT "id" FROM "Plan" WHERE "slug" = 'pro' LIMIT 1) p
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u."id");

-- First user (lowest id) becomes admin
UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT MIN("id") FROM "User");
