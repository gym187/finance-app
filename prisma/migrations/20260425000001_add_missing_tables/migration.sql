-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('BUDGET_ALERT', 'GOAL_REACHED', 'LOAN_DUE', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable Tag
CREATE TABLE IF NOT EXISTS "Tag" (
  "id"     SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "name"   TEXT NOT NULL,
  "color"  TEXT NOT NULL DEFAULT '#6b7280',
  CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE INDEX IF NOT EXISTS "Tag_userId_idx" ON "Tag"("userId");

-- CreateTable TransactionTag
CREATE TABLE IF NOT EXISTS "TransactionTag" (
  "transactionId" INTEGER NOT NULL,
  "tagId"         INTEGER NOT NULL,
  CONSTRAINT "TransactionTag_pkey" PRIMARY KEY ("transactionId", "tagId"),
  CONSTRAINT "TransactionTag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransactionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL,
  "endpoint"  TEXT NOT NULL,
  "p256dh"    TEXT NOT NULL,
  "auth"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateTable AppNotification
CREATE TABLE IF NOT EXISTS "AppNotification" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "type"      "NotificationType" NOT NULL,
  "link"      TEXT,
  "read"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AppNotification_userId_read_idx" ON "AppNotification"("userId", "read");
CREATE INDEX IF NOT EXISTS "AppNotification_userId_createdAt_idx" ON "AppNotification"("userId", "createdAt");
