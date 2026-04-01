-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('GUEST', 'STARTER', 'PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "brandDomain" TEXT,
ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "brandName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "crawlsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'GUEST';
