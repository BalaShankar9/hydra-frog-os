-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateSignatureHash" TEXT,
ADD COLUMN     "templateSignatureJson" JSONB;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "signatureJson" JSONB,
    "samplePageId" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_crawlRunId_idx" ON "Template"("crawlRunId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_crawlRunId_signatureHash_key" ON "Template"("crawlRunId", "signatureHash");

-- CreateIndex
CREATE INDEX "Page_crawlRunId_templateSignatureHash_idx" ON "Page"("crawlRunId", "templateSignatureHash");

-- CreateIndex
CREATE INDEX "Page_crawlRunId_templateId_idx" ON "Page"("crawlRunId", "templateId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
