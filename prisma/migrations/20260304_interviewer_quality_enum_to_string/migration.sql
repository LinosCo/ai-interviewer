-- Convert interviewerQuality from enum to plain text (idempotent).
-- Handles all three possible states:
--   A) Column is enum (stage-only deploy) → convert to TEXT
--   B) Column is already TEXT (main's 20260303 ran first) → ensure correct defaults/values
--   C) Column doesn't exist yet → add as TEXT (fallback)

DO $$ DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'Bot' AND column_name = 'interviewerQuality';

    IF col_type IS NULL THEN
        -- Fallback: column missing entirely
        ALTER TABLE "Bot" ADD COLUMN "interviewerQuality" TEXT NOT NULL DEFAULT 'quantitativo';
    ELSIF col_type != 'text' THEN
        -- Column is enum type → convert to TEXT
        ALTER TABLE "Bot" ALTER COLUMN "interviewerQuality" TYPE TEXT;
        ALTER TABLE "Bot" ALTER COLUMN "interviewerQuality" SET DEFAULT 'quantitativo';
        UPDATE "Bot" SET "interviewerQuality" = 'quantitativo' WHERE "interviewerQuality" = 'standard';
    ELSE
        -- Already TEXT (from 20260303_add_interviewer_quality on main) → fix legacy enum values if any
        UPDATE "Bot" SET "interviewerQuality" = 'quantitativo' WHERE "interviewerQuality" = 'standard';
    END IF;

    -- Clean up enum type if it was created by 20260304_add_interviewer_quality
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InterviewerQuality') THEN
        DROP TYPE "InterviewerQuality";
    END IF;
END $$;
