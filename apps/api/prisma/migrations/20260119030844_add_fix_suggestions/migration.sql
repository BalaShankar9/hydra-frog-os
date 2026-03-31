-- CreateEnum
CREATE TYPE "FixStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "FixType" AS ENUM ('FIX_TITLE_DUPLICATES', 'FIX_MISSING_TITLES', 'FIX_META_DESCRIPTIONS', 'FIX_CANONICALS', 'FIX_H1_ISSUES', 'FIX_THIN_CONTENT', 'FIX_IMAGE_ALT', 'FIX_404_PAGES', 'FIX_REDIRECT_CHAINS', 'FIX_NOINDEX_ACCIDENTAL', 'FIX_LCP_REGRESSION', 'FIX_CLS_REGRESSION', 'FIX_INP_REGRESSION', 'FIX_UNUSED_JS', 'FIX_RENDER_BLOCKING', 'FIX_IMAGE_OPTIMIZATION');

-- CreateTable
CREATE TABLE "FixSuggestion" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "fixType" "FixType" NOT NULL,
    "status" "FixStatus" NOT NULL DEFAULT 'OPEN',
    "priorityScore" DOUBLE PRECISION,
    "impactScore" DOUBLE PRECISION,
    "effortScore" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "evidenceJson" JSONB,
    "affectedPagesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixSuggestionItem" (
    "id" TEXT NOT NULL,
    "fixSuggestionId" TEXT NOT NULL,
    "pageId" TEXT,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT,
    "issueId" TEXT,
    "perfAuditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixSuggestionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixSuggestion_crawlRunId_priorityScore_idx" ON "FixSuggestion"("crawlRunId", "priorityScore");

-- CreateIndex
CREATE INDEX "FixSuggestion_crawlRunId_templateId_idx" ON "FixSuggestion"("crawlRunId", "templateId");

-- CreateIndex
CREATE INDEX "FixSuggestionItem_fixSuggestionId_idx" ON "FixSuggestionItem"("fixSuggestionId");

-- AddForeignKey
ALTER TABLE "FixSuggestion" ADD CONSTRAINT "FixSuggestion_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixSuggestion" ADD CONSTRAINT "FixSuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixSuggestion" ADD CONSTRAINT "FixSuggestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixSuggestionItem" ADD CONSTRAINT "FixSuggestionItem_fixSuggestionId_fkey" FOREIGN KEY ("fixSuggestionId") REFERENCES "FixSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
