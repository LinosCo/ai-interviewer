-- CreateTable (conservative: no existing data affected)
CREATE TABLE "SiteStructureCache" (
    "id" TEXT NOT NULL,
    "mcpConnectionId" TEXT,
    "cmsConnectionId" TEXT,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "posts" JSONB NOT NULL DEFAULT '[]',
    "categories" JSONB NOT NULL DEFAULT '[]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "products" JSONB,
    "productCategories" JSONB,
    "media" JSONB,
    "siteInfo" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStructureCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteStructureCache_mcpConnectionId_key" ON "SiteStructureCache"("mcpConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteStructureCache_cmsConnectionId_key" ON "SiteStructureCache"("cmsConnectionId");

-- CreateIndex
CREATE INDEX "SiteStructureCache_mcpConnectionId_idx" ON "SiteStructureCache"("mcpConnectionId");

-- CreateIndex
CREATE INDEX "SiteStructureCache_cmsConnectionId_idx" ON "SiteStructureCache"("cmsConnectionId");

-- AddForeignKey
ALTER TABLE "SiteStructureCache" ADD CONSTRAINT "SiteStructureCache_mcpConnectionId_fkey" FOREIGN KEY ("mcpConnectionId") REFERENCES "MCPConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteStructureCache" ADD CONSTRAINT "SiteStructureCache_cmsConnectionId_fkey" FOREIGN KEY ("cmsConnectionId") REFERENCES "CMSConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add seoData column to CMSSuggestion (nullable, no data loss)
ALTER TABLE "CMSSuggestion" ADD COLUMN "seoData" JSONB;
