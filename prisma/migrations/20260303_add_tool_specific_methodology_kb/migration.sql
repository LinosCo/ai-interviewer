-- Add dedicated methodology KB columns per tool (idempotent)
-- - trainingMethodologyKnowledge: used by training bots
-- - strategicMarketingKnowledge: used by strategic copilot/marketing intelligence

ALTER TABLE "PlatformSettings"
  ADD COLUMN IF NOT EXISTS "trainingMethodologyKnowledge" TEXT,
  ADD COLUMN IF NOT EXISTS "strategicMarketingKnowledge" TEXT;
