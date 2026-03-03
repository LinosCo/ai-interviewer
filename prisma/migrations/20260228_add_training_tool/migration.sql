-- CreateEnum
CREATE TYPE "TraineeEducationLevel" AS ENUM ('PRIMARY', 'SECONDARY', 'UNIVERSITY', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TraineeCompetenceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "FailureMode" AS ENUM ('STRICT', 'PERMISSIVE');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "TrainingPhase" AS ENUM ('EXPLAINING', 'CHECKING', 'QUIZZING', 'EVALUATING', 'RETRYING', 'DATA_COLLECTION', 'COMPLETE');

-- AlterTable
ALTER TABLE "KnowledgeSource" ADD COLUMN     "trainingBotId" TEXT;

-- AlterTable
ALTER TABLE "RewardConfig" ADD COLUMN     "trainingBotId" TEXT;

-- CreateTable
CREATE TABLE "TrainingBot" (
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

-- CreateTable
CREATE TABLE "TrainingTopicBlock" (
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

-- CreateTable
CREATE TABLE "TrainingSession" (
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

-- CreateTable
CREATE TABLE "TrainingMessage" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phase" "TrainingPhase" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingBot_slug_key" ON "TrainingBot"("slug");

-- CreateIndex
CREATE INDEX "TrainingBot_organizationId_idx" ON "TrainingBot"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingBot_slug_idx" ON "TrainingBot"("slug");

-- CreateIndex
CREATE INDEX "TrainingTopicBlock_trainingBotId_idx" ON "TrainingTopicBlock"("trainingBotId");

-- CreateIndex
CREATE INDEX "TrainingSession_trainingBotId_idx" ON "TrainingSession"("trainingBotId");

-- CreateIndex
CREATE INDEX "TrainingSession_participantId_idx" ON "TrainingSession"("participantId");

-- CreateIndex
CREATE INDEX "TrainingMessage_trainingSessionId_idx" ON "TrainingMessage"("trainingSessionId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_trainingBotId_idx" ON "KnowledgeSource"("trainingBotId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardConfig_trainingBotId_key" ON "RewardConfig"("trainingBotId");

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_trainingBotId_fkey" FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardConfig" ADD CONSTRAINT "RewardConfig_trainingBotId_fkey" FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingBot" ADD CONSTRAINT "TrainingBot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTopicBlock" ADD CONSTRAINT "TrainingTopicBlock_trainingBotId_fkey" FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingBotId_fkey" FOREIGN KEY ("trainingBotId") REFERENCES "TrainingBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMessage" ADD CONSTRAINT "TrainingMessage_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
