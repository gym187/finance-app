-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_adminId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_planId_fkey";

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "isInstallmentDebt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidInstallments" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
