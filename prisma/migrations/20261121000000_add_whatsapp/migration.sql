-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappJid" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "WhatsappLinkCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappLinkCode_userId_key" ON "WhatsappLinkCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappLinkCode_code_key" ON "WhatsappLinkCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappPhone_key" ON "User"("whatsappPhone");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappJid_key" ON "User"("whatsappJid");

-- AddForeignKey
ALTER TABLE "WhatsappLinkCode" ADD CONSTRAINT "WhatsappLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

