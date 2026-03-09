-- Repair migration for environments that missed 20260307_add_reviewer_notes_to_project_tip.
ALTER TABLE "ProjectTip"
ADD COLUMN IF NOT EXISTS "reviewerNotes" TEXT;
