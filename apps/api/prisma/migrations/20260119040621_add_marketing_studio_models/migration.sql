-- CreateEnum
CREATE TYPE "StudioRequestStatus" AS ENUM ('IDEA', 'REVIEW', 'APPROVED', 'BUILDING', 'QA', 'SHIPPED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StudioRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FeatureFlagScope" AS ENUM ('GLOBAL', 'ORG', 'PROJECT');

-- CreateTable
CREATE TABLE "StudioRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "desiredOutcome" TEXT NOT NULL,
    "targetUsers" TEXT,
    "priority" "StudioRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "StudioRequestStatus" NOT NULL DEFAULT 'IDEA',
    "notesJson" JSONB,
    "aiSuggestionsJson" JSONB,
    "approvedSpecId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolSpec" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "description" TEXT NOT NULL,
    "blueprintJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" "FeatureFlagScope" NOT NULL DEFAULT 'GLOBAL',
    "orgId" TEXT,
    "projectId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "changesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioRequest_orgId_status_idx" ON "StudioRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "ToolSpec_orgId_status_idx" ON "ToolSpec"("orgId", "status");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_enabled_idx" ON "FeatureFlag"("key", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_scope_orgId_projectId_key" ON "FeatureFlag"("key", "scope", "orgId", "projectId");

-- CreateIndex
CREATE INDEX "Release_version_idx" ON "Release"("version");

-- AddForeignKey
ALTER TABLE "StudioRequest" ADD CONSTRAINT "StudioRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolSpec" ADD CONSTRAINT "ToolSpec_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolSpec" ADD CONSTRAINT "ToolSpec_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudioRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
