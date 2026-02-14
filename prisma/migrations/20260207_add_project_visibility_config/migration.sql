-- CreateTable
CREATE TABLE "ProjectVisibilityConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ProjectVisibilityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVisibilityConfig_projectId_configId_key" ON "ProjectVisibilityConfig"("projectId", "configId");
CREATE INDEX "ProjectVisibilityConfig_projectId_idx" ON "ProjectVisibilityConfig"("projectId");
CREATE INDEX "ProjectVisibilityConfig_configId_idx" ON "ProjectVisibilityConfig"("configId");

-- AddForeignKey
ALTER TABLE "ProjectVisibilityConfig"
ADD CONSTRAINT "ProjectVisibilityConfig_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectVisibilityConfig"
ADD CONSTRAINT "ProjectVisibilityConfig_configId_fkey"
FOREIGN KEY ("configId") REFERENCES "VisibilityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
