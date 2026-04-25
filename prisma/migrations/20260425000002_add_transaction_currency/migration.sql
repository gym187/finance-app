-- Add currency fields to Transaction table
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "amountOriginal" DECIMAL(65,30);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(65,30);
