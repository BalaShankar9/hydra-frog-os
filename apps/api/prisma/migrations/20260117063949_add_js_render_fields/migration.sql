-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('SKIPPED', 'QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "renderConsoleErrorsJson" JSONB,
ADD COLUMN     "renderFinishedAt" TIMESTAMP(3),
ADD COLUMN     "renderNetworkErrorsJson" JSONB,
ADD COLUMN     "renderScreenshotPath" TEXT,
ADD COLUMN     "renderStartedAt" TIMESTAMP(3),
ADD COLUMN     "renderStatus" "RenderStatus" NOT NULL DEFAULT 'SKIPPED',
ADD COLUMN     "renderedCanonical" TEXT,
ADD COLUMN     "renderedFinalUrl" TEXT,
ADD COLUMN     "renderedH1Count" INTEGER,
ADD COLUMN     "renderedHtmlHash" TEXT,
ADD COLUMN     "renderedLinksCount" INTEGER,
ADD COLUMN     "renderedMetaDescription" TEXT,
ADD COLUMN     "renderedRobotsMeta" TEXT,
ADD COLUMN     "renderedTitle" TEXT,
ADD COLUMN     "renderedWordCount" INTEGER;

-- CreateIndex
CREATE INDEX "Page_crawlRunId_renderStatus_idx" ON "Page"("crawlRunId", "renderStatus");
