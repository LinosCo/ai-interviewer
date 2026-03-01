-- ============================================================
-- REPAIR MIGRATION: 20260301000000_repair_missing_tables
-- ============================================================
-- This migration is intentionally idempotent.
-- It was created to recover from migration drift where
-- _prisma_migrations showed earlier migrations as "applied"
-- but the actual tables/columns were missing from the DB.
--
-- Safe to run on a database that already has all these objects.
-- Safe to run on a database missing some or all of them.
-- ============================================================

-- ------------------------------------------------------------
-- 0. pgvector extension (needed for KnowledgeSource.embedding)
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 1. BrandReport table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "BrandReport" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "seoScore" INTEGER NOT NULL DEFAULT 0,
    "geoScore" INTEGER NOT NULL DEFAULT 0,
    "serpScore" INTEGER NOT NULL DEFAULT 0,
    "llmoScore" INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS "BrandReport_configId_createdAt_idx"
    ON "BrandReport"("configId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "BrandReport" ADD CONSTRAINT "BrandReport_configId_fkey"
        FOREIGN KEY ("configId") REFERENCES "VisibilityConfig"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- If the table already existed but the llmoScore column was missing, add it.
ALTER TABLE "BrandReport" ADD COLUMN IF NOT EXISTS "llmoScore" INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. TipRoutingRule table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TipRoutingRule" (
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

CREATE INDEX IF NOT EXISTS "TipRoutingRule_projectId_contentKind_idx"
    ON "TipRoutingRule"("projectId", "contentKind");

CREATE INDEX IF NOT EXISTS "TipRoutingRule_projectId_enabled_idx"
    ON "TipRoutingRule"("projectId", "enabled");

DO $$ BEGIN
    ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_mcpConnectionId_fkey"
        FOREIGN KEY ("mcpConnectionId") REFERENCES "MCPConnection"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_cmsConnectionId_fkey"
        FOREIGN KEY ("cmsConnectionId") REFERENCES "CMSConnection"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TipRoutingRule" ADD CONSTRAINT "TipRoutingRule_n8nConnectionId_fkey"
        FOREIGN KEY ("n8nConnectionId") REFERENCES "N8NConnection"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 3. CMSSuggestion.userFeedback column
-- ------------------------------------------------------------
ALTER TABLE "CMSSuggestion" ADD COLUMN IF NOT EXISTS "userFeedback" TEXT;

-- ------------------------------------------------------------
-- 4. KnowledgeSource.embedding column + IVFFlat index
-- ------------------------------------------------------------
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "KnowledgeSource_embedding_idx"
    ON "KnowledgeSource"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- ------------------------------------------------------------
-- 5. Training enum types
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "TraineeEducationLevel" AS ENUM (
        'PRIMARY', 'SECONDARY', 'UNIVERSITY', 'PROFESSIONAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TraineeCompetenceLevel" AS ENUM (
        'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "FailureMode" AS ENUM ('STRICT', 'PERMISSIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TrainingSessionStatus" AS ENUM (
        'STARTED', 'COMPLETED', 'FAILED', 'ABANDONED'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TrainingPhase" AS ENUM (
        'EXPLAINING', 'CHECKING', 'QUIZZING', 'EVALUATING',
        'RETRYING', 'DATA_COLLECTION', 'COMPLETE'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TokenCategory enum: add TRAINING value if missing
ALTER TYPE "TokenCategory" ADD VALUE IF NOT EXISTS 'TRAINING';

-- ------------------------------------------------------------
-- 6. TrainingBot table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingBot" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BotStatus" NOT NULL DEFAULT 'DRAFT',
    "learningGoal" TEXT,
    "targetAudience" TEXT,
    "language" TEXT NOT NULL DEFAULT 'it',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "traineeEducationLevel" "TraineeEducationLevel" NOT NULL DEFAULT 'PROFESSIONAL',
    "traineeCompetenceLevel" "TraineeCompetenceLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "failureMode" "FailureMode" NOT NULL DEFAULT 'PERMISSIVE',
    "passScoreThreshold" INTEGER NOT NULL DEFAULT 70,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "introMessage" TEXT,
    "maxDurationMins" INTEGER NOT NULL DEFAULT 30,
    "useWarmup" BOOLEAN NOT NULL DEFAULT false,
    "warmupIcebreaker" TEXT,
    "collectTraineeData" BOOLEAN NOT NULL DEFAULT false,
    "traineeDataFields" JSONB,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "showProgressBar" BOOLEAN NOT NULL DEFAULT true,
    "welcomeTitle" TEXT,
    "welcomeSubtitle" TEXT,
    "modelProvider" TEXT NOT NULL DEFAULT 'openai',
    "modelName" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "customApiKey" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingBot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingBot_slug_key" ON "TrainingBot"("slug");
CREATE INDEX IF NOT EXISTS "TrainingBot_organizationId_idx" ON "TrainingBot"("organizationId");
-- Note: TrainingBot_slug_idx is intentionally omitted (redundant with unique index, see index_fixes migration)

DO $$ BEGIN
    ALTER TABLE "TrainingBot" ADD CONSTRAINT "TrainingBot_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 7. TrainingTopicBlock table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingTopicBlock" (
    "id" TEXT NOT NULL,
    "trainingBotId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "learningObjectives" TEXT[],
    "preWrittenQuizzes" JSONB,
    "passScoreOverride" INTEGER,
    "maxRetriesOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingTopicBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingTopicBlock_trainingBotId_idx"
    ON "TrainingTopicBlock"("trainingBotId");

DO $$ BEGIN
    ALTER TABLE "TrainingTopicBlock" ADD CONSTRAINT "TrainingTopicBlock_trainingBotId_fkey"
        FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 8. TrainingSession table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingSession" (
    "id" TEXT NOT NULL,
    "trainingBotId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'STARTED',
    "currentTopicId" TEXT,
    "topicResults" JSONB NOT NULL DEFAULT '[]',
    "overallScore" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "detectedCompetenceLevel" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "traineeProfile" JSONB,
    "supervisorState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingSession_trainingBotId_idx"
    ON "TrainingSession"("trainingBotId");

CREATE INDEX IF NOT EXISTS "TrainingSession_participantId_idx"
    ON "TrainingSession"("participantId");

-- Compound index from index_fixes migration
CREATE INDEX IF NOT EXISTS "TrainingSession_trainingBotId_participantId_idx"
    ON "TrainingSession"("trainingBotId", "participantId");

DO $$ BEGIN
    ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingBotId_fkey"
        FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 9. TrainingMessage table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingMessage" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingMessage_trainingSessionId_idx"
    ON "TrainingMessage"("trainingSessionId");

DO $$ BEGIN
    ALTER TABLE "TrainingMessage" ADD CONSTRAINT "TrainingMessage_trainingSessionId_fkey"
        FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 10. KnowledgeSource.trainingBotId and RewardConfig.trainingBotId
--     (columns that link to TrainingBot — added after TrainingBot exists)
-- ------------------------------------------------------------
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "trainingBotId" TEXT;
ALTER TABLE "RewardConfig" ADD COLUMN IF NOT EXISTS "trainingBotId" TEXT;

CREATE INDEX IF NOT EXISTS "KnowledgeSource_trainingBotId_idx"
    ON "KnowledgeSource"("trainingBotId");

CREATE UNIQUE INDEX IF NOT EXISTS "RewardConfig_trainingBotId_key"
    ON "RewardConfig"("trainingBotId");

DO $$ BEGIN
    ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_trainingBotId_fkey"
        FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RewardConfig" ADD CONSTRAINT "RewardConfig_trainingBotId_fkey"
        FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 11. Drop redundant slug index (from training_schema_index_fixes)
-- ------------------------------------------------------------
DROP INDEX IF EXISTS "TrainingBot_slug_idx";
