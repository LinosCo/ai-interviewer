-- prisma/migrations/20260301_training_dialogue_kb/migration.sql
-- Idempotent migration for training dialogue + KB features

-- 1. Make KnowledgeSource.botId nullable
--    (training bot KB sources have trainingBotId but no regular botId)
ALTER TABLE "KnowledgeSource" ALTER COLUMN "botId" DROP NOT NULL;

-- 2. Add dialogue turn limits to TrainingTopicBlock
ALTER TABLE "TrainingTopicBlock"
  ADD COLUMN IF NOT EXISTS "minCheckingTurns" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "maxCheckingTurns" INTEGER NOT NULL DEFAULT 6;

-- 3. Add new TrainingPhase enum values
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'DIALOGUING';
ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS 'FINAL_QUIZZING';
