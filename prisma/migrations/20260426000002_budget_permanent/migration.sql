-- Orçamentos agora são permanentes: month vira nullable e alertedMonth é adicionado
ALTER TABLE "Budget" ALTER COLUMN "month" DROP NOT NULL;
UPDATE "Budget" SET "month" = NULL;

ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "alertedMonth" TEXT;

DROP INDEX IF EXISTS "Budget_userId_month_idx";
CREATE INDEX IF NOT EXISTS "Budget_userId_idx" ON "Budget"("userId");
