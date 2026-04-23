-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('STOCK', 'FII', 'ETF', 'CRYPTO', 'FIXED_INCOME', 'OTHER');

-- CreateTable
CREATE TABLE "Investment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "type" "InvestmentType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "averagePrice" DECIMAL(65,30) NOT NULL,
    "currentPrice" DECIMAL(65,30),
    "targetPercent" DECIMAL(65,30),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
