-- AddColumn: cilBonusTurnCapOverride to Bot model (CIL Task 1)
-- null = dynamic formula; set to override CIL budget stealing cap
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "cilBonusTurnCapOverride" INTEGER;
