-- Convert interviewerQuality from enum to plain text (supports quantitativo/intermedio/avanzato)

-- Step 1: Convert column from enum to text
ALTER TABLE "Bot" ALTER COLUMN "interviewerQuality" TYPE TEXT;

-- Step 2: Update default value
ALTER TABLE "Bot" ALTER COLUMN "interviewerQuality" SET DEFAULT 'quantitativo';

-- Step 3: Migrate old enum values to new tier names
UPDATE "Bot" SET "interviewerQuality" = 'quantitativo' WHERE "interviewerQuality" = 'standard';

-- Step 4: Drop the enum type (no longer needed)
DROP TYPE IF EXISTS "InterviewerQuality";
