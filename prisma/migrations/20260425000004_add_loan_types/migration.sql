-- CreateEnum LoanType
DO $$ BEGIN
  CREATE TYPE "LoanType" AS ENUM ('LOAN', 'CREDIT_CARD', 'BOLETO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to Loan
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "type"       "LoanType" NOT NULL DEFAULT 'LOAN';
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "dueDate"    TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "closingDay" INTEGER;

-- Make startDate and dueDayOfMonth optional (add defaults so existing rows stay valid)
ALTER TABLE "Loan" ALTER COLUMN "startDate"     SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Loan" ALTER COLUMN "dueDayOfMonth" SET DEFAULT 1;
ALTER TABLE "Loan" ALTER COLUMN "interestRate"  SET DEFAULT 0;

-- New indexes
CREATE INDEX IF NOT EXISTS "Loan_userId_type_idx" ON "Loan"("userId", "type");
