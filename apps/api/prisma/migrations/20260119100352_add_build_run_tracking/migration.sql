-- CreateEnum
CREATE TYPE "BuildRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "BuildRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" "BuildRunStatus" NOT NULL DEFAULT 'QUEUED',
    "branchName" TEXT,
    "prUrl" TEXT,
    "commitSha" TEXT,
    "logsJson" JSONB,
    "errorJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildRun_orgId_status_idx" ON "BuildRun"("orgId", "status");

-- CreateIndex
CREATE INDEX "BuildRun_specId_createdAt_idx" ON "BuildRun"("specId", "createdAt");

-- AddForeignKey
ALTER TABLE "BuildRun" ADD CONSTRAINT "BuildRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildRun" ADD CONSTRAINT "BuildRun_specId_fkey" FOREIGN KEY ("specId") REFERENCES "ToolSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;
