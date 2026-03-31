-- CreateEnum
CREATE TYPE "DiffType" AS ENUM ('NEW_URL', 'REMOVED_URL', 'STATUS_CHANGED', 'REDIRECT_CHAIN_CHANGED', 'TITLE_CHANGED', 'META_DESCRIPTION_CHANGED', 'CANONICAL_CHANGED', 'ROBOTS_CHANGED', 'H1_COUNT_CHANGED', 'WORDCOUNT_CHANGED', 'HTML_HASH_CHANGED', 'TEMPLATE_CHANGED', 'ISSUE_COUNT_CHANGED');

-- CreateEnum
CREATE TYPE "DiffSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "CrawlDiff" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromRunId" TEXT NOT NULL,
    "toRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryJson" JSONB,

    CONSTRAINT "CrawlDiff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlDiffItem" (
    "id" TEXT NOT NULL,
    "diffId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "DiffType" NOT NULL,
    "severity" "DiffSeverity" NOT NULL,
    "direction" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlDiffItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlDiff_projectId_createdAt_idx" ON "CrawlDiff"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlDiff_fromRunId_toRunId_key" ON "CrawlDiff"("fromRunId", "toRunId");

-- CreateIndex
CREATE INDEX "CrawlDiffItem_diffId_type_idx" ON "CrawlDiffItem"("diffId", "type");

-- CreateIndex
CREATE INDEX "CrawlDiffItem_diffId_severity_idx" ON "CrawlDiffItem"("diffId", "severity");

-- CreateIndex
CREATE INDEX "CrawlDiffItem_diffId_normalizedUrl_idx" ON "CrawlDiffItem"("diffId", "normalizedUrl");

-- AddForeignKey
ALTER TABLE "CrawlDiff" ADD CONSTRAINT "CrawlDiff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlDiffItem" ADD CONSTRAINT "CrawlDiffItem_diffId_fkey" FOREIGN KEY ("diffId") REFERENCES "CrawlDiff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
