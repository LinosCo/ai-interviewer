-- AddColumn: interviewerQuality to Bot model
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "interviewerQuality" TEXT NOT NULL DEFAULT 'quantitativo';

-- AddColumn: interviewerQuality to TrainingBot model
ALTER TABLE "TrainingBot" ADD COLUMN IF NOT EXISTS "interviewerQuality" TEXT NOT NULL DEFAULT 'quantitativo';
