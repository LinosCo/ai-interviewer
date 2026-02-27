-- CreateTable
CREATE TABLE "TipRoutingRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contentKind" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "mcpConnectionId" TEXT,
    "cmsConnectionId" TEXT,
    "n8nConnectionId" TEXT,
    "mcpTool" TEXT,
    "behavior" TEXT NOT NULL,
    "behaviorConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipRoutingRule_projectId_contentKind_idx" ON "TipRoutingRule"("projectId", "contentKind");

-- CreateIndex
CREATE INDEX "TipRoutingRule_projectId_enabled_idx" ON "TipRoutingRule"("projectId", "enabled");

-- AddForeignKey
ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_mcpConnectionId_fkey" FOREIGN KEY ("mcpConnectionId") REFERENCES "MCPConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_cmsConnectionId_fkey" FOREIGN KEY ("cmsConnectionId") REFERENCES "CMSConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_n8nConnectionId_fkey" FOREIGN KEY ("n8nConnectionId") REFERENCES "N8NConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
