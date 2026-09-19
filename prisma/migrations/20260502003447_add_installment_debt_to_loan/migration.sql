-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "isInstallmentDebt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidInstallments" INTEGER NOT NULL DEFAULT 0;
