-- Fix 1: Remove redundant slug index on TrainingBot
-- The slug field is already @unique which creates a unique index; a plain @@index([slug]) is wasteful.
DROP INDEX IF EXISTS "TrainingBot_slug_idx";

-- Fix 2: Add compound index on TrainingSession for common query pattern
-- "all sessions for a trainee in a given bot"
CREATE INDEX IF NOT EXISTS "TrainingSession_trainingBotId_participantId_idx"
    ON "TrainingSession" ("trainingBotId", "participantId");
