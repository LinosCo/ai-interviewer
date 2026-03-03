-- AddCMSPerformanceTracking
-- Migration sicura: aggiunge solo nuovi campi nullable senza modificare dati esistenti

-- Aggiungi campo performanceBefore per metriche pre-applicazione
ALTER TABLE "CMSSuggestion" ADD COLUMN IF NOT EXISTS "performanceBefore" JSONB;

-- Aggiungi campo performanceAfter per metriche post-applicazione (dopo 7 giorni)
ALTER TABLE "CMSSuggestion" ADD COLUMN IF NOT EXISTS "performanceAfter" JSONB;

-- Aggiungi campo createdBy per tracciare chi ha creato/approvato il suggerimento
ALTER TABLE "CMSSuggestion" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- Commento: Questa migration e' non-distruttiva
-- - Tutti i campi sono nullable (nessun NOT NULL)
-- - Usa IF NOT EXISTS per sicurezza in caso di re-run
-- - Non modifica o elimina alcun dato esistente
