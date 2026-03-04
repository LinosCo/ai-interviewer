-- CreateTable
CREATE TABLE "CopilotAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "CopilotAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotAlert_organizationId_isRead_idx" ON "CopilotAlert"("organizationId", "isRead");

-- CreateIndex
CREATE INDEX "CopilotAlert_organizationId_createdAt_idx" ON "CopilotAlert"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CopilotAlert" ADD CONSTRAINT "CopilotAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
