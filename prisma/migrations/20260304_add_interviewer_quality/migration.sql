-- Safe: adds interviewerQuality as enum only if column doesn't already exist.
-- When 20260303_add_interviewer_quality (TEXT version from main) ran first,
-- the column exists and this migration is a no-op on the column.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InterviewerQuality') THEN
        CREATE TYPE "InterviewerQuality" AS ENUM ('standard', 'avanzato');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Bot' AND column_name = 'interviewerQuality'
    ) THEN
        ALTER TABLE "Bot" ADD COLUMN "interviewerQuality" "InterviewerQuality" NOT NULL DEFAULT 'standard';
    END IF;
END $$;
