-- Fix interviewerQuality default: rename legacy "quantitativo" value to "standard"
-- Both Bot and TrainingBot models had @default("quantitativo") which does not match
-- the runtime values consumed by the interview engine ('standard' | 'avanzato').

ALTER TABLE "Bot" ALTER COLUMN "interviewerQuality" SET DEFAULT 'standard';
ALTER TABLE "TrainingBot" ALTER COLUMN "interviewerQuality" SET DEFAULT 'standard';

UPDATE "Bot" SET "interviewerQuality" = 'standard' WHERE "interviewerQuality" = 'quantitativo';
UPDATE "TrainingBot" SET "interviewerQuality" = 'standard' WHERE "interviewerQuality" = 'quantitativo';
