-- This is a safe migration that adds new tables without modifying existing ones
-- NO DATA WILL BE DELETED OR MODIFIED

-- Add new junction tables for multi-project support
CREATE TABLE IF NOT EXISTS "ProjectCMSConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ProjectCMSConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectMCPConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ProjectMCPConnection_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCMSConnection_projectId_connectionId_key" ON "ProjectCMSConnection"("projectId", "connectionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMCPConnection_projectId_connectionId_key" ON "ProjectMCPConnection"("projectId", "connectionId");

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "ProjectCMSConnection_projectId_idx" ON "ProjectCMSConnection"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectCMSConnection_connectionId_idx" ON "ProjectCMSConnection"("connectionId");
CREATE INDEX IF NOT EXISTS "ProjectMCPConnection_projectId_idx" ON "ProjectMCPConnection"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMCPConnection_connectionId_idx" ON "ProjectMCPConnection"("connectionId");

-- Add foreign key constraints
ALTER TABLE "ProjectCMSConnection" ADD CONSTRAINT "ProjectCMSConnection_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectCMSConnection" ADD CONSTRAINT "ProjectCMSConnection_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "CMSConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMCPConnection" ADD CONSTRAINT "ProjectMCPConnection_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMCPConnection" ADD CONSTRAINT "ProjectMCPConnection_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "MCPConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add organizationId to MCPConnection if not exists (for organization-level management)
ALTER TABLE "MCPConnection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Create index for organizationId in MCPConnection
CREATE INDEX IF NOT EXISTS "MCPConnection_organizationId_idx" ON "MCPConnection"("organizationId");

-- Add foreign key for organizationId in MCPConnection
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MCPConnection_organizationId_fkey'
    ) THEN
        ALTER TABLE "MCPConnection" ADD CONSTRAINT "MCPConnection_organizationId_fkey"
            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
