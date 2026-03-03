-- CreateTable: BrandReport
CREATE TABLE "BrandReport" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "seoScore" INTEGER NOT NULL DEFAULT 0,
    "geoScore" INTEGER NOT NULL DEFAULT 0,
    "serpScore" INTEGER NOT NULL DEFAULT 0,
    "pagesAudited" INTEGER NOT NULL DEFAULT 0,
    "seoAuditData" JSONB,
    "geoData" JSONB,
    "serpData" JSONB,
    "gscInsights" JSONB,
    "gaInsights" JSONB,
    "aiTips" JSONB,
    "generatedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandReport_configId_createdAt_idx" ON "BrandReport"("configId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandReport" ADD CONSTRAINT "BrandReport_configId_fkey" FOREIGN KEY ("configId") REFERENCES "VisibilityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
