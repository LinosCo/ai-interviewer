-- CreateEnum
CREATE TYPE "InterviewerQuality" AS ENUM ('standard', 'avanzato');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN "interviewerQuality" "InterviewerQuality" NOT NULL DEFAULT 'standard';
