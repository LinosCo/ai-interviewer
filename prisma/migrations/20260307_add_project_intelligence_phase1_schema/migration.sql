-- CreateEnum
CREATE TYPE "MethodologyProfileStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectMethodologyRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('BOT', 'KNOWLEDGE_SOURCE', 'VISIBILITY_CONFIG', 'GOOGLE_CONNECTION', 'CMS_CONNECTION', 'MCP_CONNECTION', 'N8N_CONNECTION');

-- CreateEnum
CREATE TYPE "DataSourceOwnershipMode" AS ENUM ('DEDICATED', 'SHARED');

-- CreateEnum
CREATE TYPE "ProjectDataSourceBindingRole" AS ENUM ('PRIMARY', 'SECONDARY', 'REFERENCE', 'EXECUTION');

-- CreateEnum
CREATE TYPE "ProjectTipOriginType" AS ENUM ('CROSS_CHANNEL_INSIGHT', 'WEBSITE_ANALYSIS', 'BRAND_REPORT', 'COPILOT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProjectTipStatus" AS ENUM ('NEW', 'REVIEWED', 'APPROVED', 'DRAFTED', 'ROUTED', 'AUTOMATED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TipApprovalMode" AS ENUM ('MANUAL', 'AUTO_APPROVE', 'AUTO_EXECUTE');

-- CreateEnum
CREATE TYPE "TipDraftStatus" AS ENUM ('NONE', 'READY', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "TipRoutingStatus" AS ENUM ('NONE', 'PLANNED', 'READY', 'DISPATCHED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "TipPublishStatus" AS ENUM ('NOT_APPLICABLE', 'NOT_STARTED', 'DRAFT_READY', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "TipRevisionEditorType" AS ENUM ('SYSTEM', 'USER', 'COPILOT');

-- CreateEnum
CREATE TYPE "TipRouteDestinationType" AS ENUM ('CMS', 'MCP', 'N8N', 'WEBHOOK', 'SEO_INTERVENTION', 'INTERNAL_TASK');

-- CreateEnum
CREATE TYPE "TipRoutePolicyMode" AS ENUM ('MANUAL', 'AUTO_APPROVE', 'AUTO_EXECUTE');

-- CreateEnum
CREATE TYPE "TipRouteStatus" AS ENUM ('PLANNED', 'READY', 'DISPATCHED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "TipExecutionRunType" AS ENUM ('MANUAL', 'AUTOMATIC', 'COPILOT');

-- CreateEnum
CREATE TYPE "TipExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "ProjectStrategy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "positioning" TEXT,
    "valueProposition" TEXT,
    "targetAudiences" JSONB,
    "strategicGoals" JSONB,
    "priorityKpis" JSONB,
    "keyOffers" JSONB,
    "constraints" JSONB,
    "toneGuidelines" TEXT,
    "editorialPriorities" JSONB,
    "channelPriorities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "knowledge" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "MethodologyProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodologyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMethodologyBinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "methodologyProfileId" TEXT NOT NULL,
    "role" "ProjectMethodologyRole" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMethodologyBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "DataSourceType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownershipMode" "DataSourceOwnershipMode" NOT NULL DEFAULT 'DEDICATED',
    "label" TEXT,
    "status" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDataSourceBinding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "bindingRole" "ProjectDataSourceBindingRole" NOT NULL DEFAULT 'PRIMARY',
    "channelIntent" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDataSourceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTip" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originType" "ProjectTipOriginType" NOT NULL,
    "originId" TEXT,
    "originItemKey" TEXT,
    "originFingerprint" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ProjectTipStatus" NOT NULL DEFAULT 'NEW',
    "priority" DOUBLE PRECISION,
    "category" TEXT,
    "contentKind" TEXT,
    "executionClass" TEXT,
    "approvalMode" "TipApprovalMode" NOT NULL DEFAULT 'MANUAL',
    "draftStatus" "TipDraftStatus" NOT NULL DEFAULT 'NONE',
    "routingStatus" "TipRoutingStatus" NOT NULL DEFAULT 'NONE',
    "publishStatus" "TipPublishStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "strategicAlignment" TEXT,
    "methodologySummary" TEXT,
    "methodologyRefs" JSONB,
    "sourceSnapshot" JSONB,
    "recommendedActions" JSONB,
    "suggestedRouting" JSONB,
    "createdBy" TEXT,
    "lastEditedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTipEvidence" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceEntityId" TEXT,
    "sourceLabel" TEXT,
    "detail" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION,
    "metricUnit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTipEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTipRevision" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "editorType" "TipRevisionEditorType" NOT NULL,
    "editorUserId" TEXT,
    "changeSummary" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTipRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTipRoute" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "destinationType" "TipRouteDestinationType" NOT NULL,
    "destinationRefId" TEXT,
    "policyMode" "TipRoutePolicyMode" NOT NULL DEFAULT 'MANUAL',
    "status" "TipRouteStatus" NOT NULL DEFAULT 'PLANNED',
    "payloadPreview" JSONB,
    "lastDispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTipRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTipExecution" (
    "id" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "routeId" TEXT,
    "runType" "TipExecutionRunType" NOT NULL,
    "status" "TipExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "executedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectTipExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStrategy_projectId_key" ON "ProjectStrategy"("projectId");

-- CreateIndex
CREATE INDEX "MethodologyProfile_organizationId_status_idx" ON "MethodologyProfile"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MethodologyProfile_organizationId_slug_key" ON "MethodologyProfile"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "ProjectMethodologyBinding_projectId_role_idx" ON "ProjectMethodologyBinding"("projectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMethodologyBinding_projectId_methodologyProfileId_key" ON "ProjectMethodologyBinding"("projectId", "methodologyProfileId");

-- CreateIndex
CREATE INDEX "DataSource_organizationId_sourceType_idx" ON "DataSource"("organizationId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_sourceType_entityId_key" ON "DataSource"("sourceType", "entityId");

-- CreateIndex
CREATE INDEX "ProjectDataSourceBinding_projectId_bindingRole_idx" ON "ProjectDataSourceBinding"("projectId", "bindingRole");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDataSourceBinding_projectId_dataSourceId_key" ON "ProjectDataSourceBinding"("projectId", "dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTip_originFingerprint_key" ON "ProjectTip"("originFingerprint");

-- CreateIndex
CREATE INDEX "ProjectTip_projectId_status_idx" ON "ProjectTip"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTip_projectId_starred_idx" ON "ProjectTip"("projectId", "starred");

-- CreateIndex
CREATE INDEX "ProjectTip_projectId_originType_idx" ON "ProjectTip"("projectId", "originType");

-- CreateIndex
CREATE INDEX "ProjectTipEvidence_tipId_sortOrder_idx" ON "ProjectTipEvidence"("tipId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectTipRevision_tipId_createdAt_idx" ON "ProjectTipRevision"("tipId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectTipRoute_tipId_status_idx" ON "ProjectTipRoute"("tipId", "status");

-- CreateIndex
CREATE INDEX "ProjectTipExecution_tipId_startedAt_idx" ON "ProjectTipExecution"("tipId", "startedAt");

-- CreateIndex
CREATE INDEX "ProjectTipExecution_routeId_startedAt_idx" ON "ProjectTipExecution"("routeId", "startedAt");

-- AddForeignKey
ALTER TABLE "ProjectStrategy" ADD CONSTRAINT "ProjectStrategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MethodologyProfile" ADD CONSTRAINT "MethodologyProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMethodologyBinding" ADD CONSTRAINT "ProjectMethodologyBinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMethodologyBinding" ADD CONSTRAINT "ProjectMethodologyBinding_methodologyProfileId_fkey" FOREIGN KEY ("methodologyProfileId") REFERENCES "MethodologyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDataSourceBinding" ADD CONSTRAINT "ProjectDataSourceBinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDataSourceBinding" ADD CONSTRAINT "ProjectDataSourceBinding_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTip" ADD CONSTRAINT "ProjectTip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTip" ADD CONSTRAINT "ProjectTip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTipEvidence" ADD CONSTRAINT "ProjectTipEvidence_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ProjectTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTipRevision" ADD CONSTRAINT "ProjectTipRevision_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ProjectTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTipRoute" ADD CONSTRAINT "ProjectTipRoute_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ProjectTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTipExecution" ADD CONSTRAINT "ProjectTipExecution_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "ProjectTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTipExecution" ADD CONSTRAINT "ProjectTipExecution_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ProjectTipRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
