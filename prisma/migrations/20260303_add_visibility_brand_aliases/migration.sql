-- Add brand aliases to visibility config for manual variant matching
ALTER TABLE "VisibilityConfig"
  ADD COLUMN IF NOT EXISTS "brandAliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "VisibilityConfig"
SET "brandAliases" = ARRAY[]::TEXT[]
WHERE "brandAliases" IS NULL;
