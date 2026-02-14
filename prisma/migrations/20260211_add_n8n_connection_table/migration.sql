-- CreateTable
CREATE TABLE "N8NConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'n8n Automation',
    "webhookUrl" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "lastTriggerAt" TIMESTAMP(3),
    "lastError" TEXT,
    "triggerOnTips" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "N8NConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "N8NConnection_projectId_key" ON "N8NConnection"("projectId");

-- CreateIndex
CREATE INDEX "N8NConnection_projectId_idx" ON "N8NConnection"("projectId");

-- AddForeignKey
ALTER TABLE "N8NConnection" ADD CONSTRAINT "N8NConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
