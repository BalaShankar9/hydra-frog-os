-- CreateEnum
CREATE TYPE "PerfAuditStatus" AS ENUM ('SKIPPED', 'QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "PerfDevice" AS ENUM ('MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "PerfRegressionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "PerfAudit" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT,
    "templateId" TEXT,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "device" "PerfDevice" NOT NULL DEFAULT 'MOBILE',
    "status" "PerfAuditStatus" NOT NULL DEFAULT 'SKIPPED',
    "score" DOUBLE PRECISION,
    "metricsJson" JSONB,
    "opportunitiesJson" JSONB,
    "reportHtmlPath" TEXT,
    "reportJsonPath" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "normalizedUrl" TEXT,
    "device" "PerfDevice" NOT NULL DEFAULT 'MOBILE',
    "baselineJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfRegressionItem" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "PerfRegressionSeverity" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "deltaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfRegressionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfAudit_crawlRunId_status_idx" ON "PerfAudit"("crawlRunId", "status");

-- CreateIndex
CREATE INDEX "PerfAudit_crawlRunId_templateId_idx" ON "PerfAudit"("crawlRunId", "templateId");

-- CreateIndex
CREATE INDEX "PerfAudit_projectId_createdAt_idx" ON "PerfAudit"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PerfAudit_crawlRunId_normalizedUrl_device_key" ON "PerfAudit"("crawlRunId", "normalizedUrl", "device");

-- CreateIndex
CREATE INDEX "PerfBaseline_projectId_idx" ON "PerfBaseline"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfBaseline_projectId_templateId_device_key" ON "PerfBaseline"("projectId", "templateId", "device");

-- CreateIndex
CREATE INDEX "PerfRegressionItem_crawlRunId_severity_idx" ON "PerfRegressionItem"("crawlRunId", "severity");

-- CreateIndex
CREATE INDEX "PerfRegressionItem_crawlRunId_templateId_idx" ON "PerfRegressionItem"("crawlRunId", "templateId");

-- AddForeignKey
ALTER TABLE "PerfAudit" ADD CONSTRAINT "PerfAudit_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAudit" ADD CONSTRAINT "PerfAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAudit" ADD CONSTRAINT "PerfAudit_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAudit" ADD CONSTRAINT "PerfAudit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfBaseline" ADD CONSTRAINT "PerfBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfRegressionItem" ADD CONSTRAINT "PerfRegressionItem_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfRegressionItem" ADD CONSTRAINT "PerfRegressionItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
