-- =============================================================
-- V2 CORE DATA SCHEMA - NON-DESTRUCTIVE MIGRATION
-- Mantiene lo schema V1 esistente (analysis_queries, profiles, etc.)
-- e aggiunge le nuove tabelle V2 per il sistema avanzato di tracking
-- =============================================================

-- -------------------------------------------------------------
-- 1. USER_PROJECTS: Progetti utente (contenitore principale)
-- Un utente può avere più progetti, ogni progetto contiene brand, prompt, run
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb -- Per configurazioni future del progetto
);

COMMENT ON TABLE public.user_projects IS 'V2: Progetti utente - contenitore principale per brand, prompt e analisi';

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects" ON public.user_projects
    FOR ALL USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 2. AI_MODELS: Modelli AI supportati (es. gpt-4, claude-3, gemini)
-- Tabella di riferimento per i modelli AI disponibili
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- es. "gpt-4", "claude-3-opus"
    provider TEXT NOT NULL, -- es. "openai", "anthropic", "google"
    display_name TEXT NOT NULL, -- es. "GPT-4 Turbo"
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB DEFAULT '[]'::jsonb, -- es. ["chat", "analysis", "vision"]
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_models IS 'V2: Registro modelli AI supportati dal sistema';

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read models" ON public.ai_models FOR SELECT USING (true);
CREATE POLICY "Only admins can modify models" ON public.ai_models FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Pre-popola modelli comuni
INSERT INTO public.ai_models (name, provider, display_name, description, capabilities) VALUES
    ('gpt-4', 'openai', 'GPT-4', 'OpenAI GPT-4 model', '["chat", "analysis"]'),
    ('gpt-4-turbo', 'openai', 'GPT-4 Turbo', 'OpenAI GPT-4 Turbo model', '["chat", "analysis"]'),
    ('claude-3-opus', 'anthropic', 'Claude 3 Opus', 'Anthropic Claude 3 Opus model', '["chat", "analysis"]'),
    ('claude-3-sonnet', 'anthropic', 'Claude 3 Sonnet', 'Anthropic Claude 3 Sonnet model', '["chat", "analysis"]'),
    ('gemini-pro', 'google', 'Gemini Pro', 'Google Gemini Pro model', '["chat", "analysis"]'),
    ('perplexity', 'perplexity', 'Perplexity', 'Perplexity AI search model', '["search", "analysis"]')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------
-- 3. TOPICS: Tematiche/Argomenti per raggruppare prompt
-- Permette di categorizzare i prompt per argomento
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1', -- Per UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.topics IS 'V2: Tematiche per categorizzare i prompt';

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage topics via project" ON public.topics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_projects WHERE id = project_id AND user_id = auth.uid())
    );

-- -------------------------------------------------------------
-- 4. TAGS: Tag riutilizzabili per brand e prompt (N:N)
-- Tag generici che possono essere associati a brand o prompt
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#8b5cf6', -- Per UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, name)
);

COMMENT ON TABLE public.tags IS 'V2: Tag riutilizzabili per categorizzare brand e prompt';

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tags via project" ON public.tags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_projects WHERE id = project_id AND user_id = auth.uid())
    );

-- -------------------------------------------------------------
-- 5. BRANDS: Brand da tracciare all'interno di un progetto
-- Rappresenta un brand/prodotto da monitorare
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website_url TEXT,
    logo_url TEXT,
    description TEXT,
    industry TEXT,
    market TEXT,
    aliases TEXT[] DEFAULT '{}', -- Nomi alternativi del brand
    competitors TEXT[] DEFAULT '{}', -- Competitor noti
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brands IS 'V2: Brand/prodotti da tracciare per visibilità AI';

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage brands via project" ON public.brands
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_projects WHERE id = project_id AND user_id = auth.uid())
    );

-- -------------------------------------------------------------
-- 6. BRAND_TAGS: Relazione N:N tra Brand e Tag
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_tags (
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (brand_id, tag_id)
);

COMMENT ON TABLE public.brand_tags IS 'V2: Relazione N:N tra brand e tag';

ALTER TABLE public.brand_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage brand_tags via brand" ON public.brand_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.brands b 
            JOIN public.user_projects p ON b.project_id = p.id 
            WHERE b.id = brand_id AND p.user_id = auth.uid()
        )
    );

-- -------------------------------------------------------------
-- 7. PROMPTS: Prompt/Query da testare sugli AI
-- Domande che vengono inviate ai modelli AI per testare la visibilità
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL, -- 0/1 topic
    text TEXT NOT NULL, -- Il testo del prompt
    category TEXT, -- es. "informational", "transactional", "navigational"
    intent TEXT, -- es. "comparison", "recommendation", "how-to"
    language TEXT DEFAULT 'it',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.prompts IS 'V2: Prompt/query da testare sui modelli AI';

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prompts via project" ON public.prompts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_projects WHERE id = project_id AND user_id = auth.uid())
    );

-- -------------------------------------------------------------
-- 8. PROMPT_TAGS: Relazione N:N tra Prompt e Tag
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prompt_tags (
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

COMMENT ON TABLE public.prompt_tags IS 'V2: Relazione N:N tra prompt e tag';

ALTER TABLE public.prompt_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prompt_tags via prompt" ON public.prompt_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.prompts pr 
            JOIN public.user_projects p ON pr.project_id = p.id 
            WHERE pr.id = prompt_id AND p.user_id = auth.uid()
        )
    );

-- -------------------------------------------------------------
-- 9. SOURCES: Domini/URL citati dalle AI
-- Registro di tutte le fonti citate nelle risposte AI
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL UNIQUE, -- es. "example.com"
    full_url TEXT, -- URL completo se disponibile
    name TEXT, -- Nome del sito se noto
    category TEXT, -- es. "news", "blog", "ecommerce", "official"
    trust_score INTEGER DEFAULT 50, -- 0-100 punteggio di affidabilità
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.sources IS 'V2: Registro fonti/domini citati dalle AI';

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sources" ON public.sources FOR SELECT USING (true);
CREATE POLICY "Only admins can modify sources" ON public.sources FOR ALL USING (has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------
-- 10. ANALYSIS_RUNS: Singola esecuzione di analisi
-- Collega progetto, brand, prompt, modello per una singola run
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE RESTRICT,
    
    -- Risultati dell'analisi
    raw_response TEXT, -- Risposta grezza del modello
    brand_mentioned BOOLEAN DEFAULT false,
    brand_position INTEGER, -- Posizione del brand nella risposta (1-based, null se non menzionato)
    competitors_mentioned TEXT[] DEFAULT '{}',
    sentiment TEXT, -- "positive", "neutral", "negative"
    confidence_score NUMERIC(3,2), -- 0.00 - 1.00
    
    -- Metadata esecuzione
    execution_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd NUMERIC(10,6),
    error_message TEXT,
    status TEXT DEFAULT 'pending', -- "pending", "running", "completed", "failed"
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.analysis_runs IS 'V2: Singola esecuzione di analisi AI - collega progetto, brand, prompt e modello';

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage runs via project" ON public.analysis_runs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_projects WHERE id = project_id AND user_id = auth.uid())
    );

-- -------------------------------------------------------------
-- 11. VISIBILITY_METRICS: Metriche aggregate per brand+model+periodo
-- Statistiche aggregate per monitoraggio nel tempo
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visibility_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE RESTRICT,
    
    -- Periodo di riferimento
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Metriche aggregate
    visibility_score NUMERIC(5,2), -- 0-100
    mention_rate NUMERIC(5,2), -- % di volte che il brand è menzionato
    avg_position NUMERIC(4,2), -- Posizione media quando menzionato
    sentiment_score NUMERIC(3,2), -- -1.00 a +1.00
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    
    -- Competitor analysis
    top_competitors JSONB DEFAULT '[]'::jsonb, -- [{name, mentions, avg_position}]
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(brand_id, model_id, period_start, period_end)
);

COMMENT ON TABLE public.visibility_metrics IS 'V2: Metriche aggregate visibilità per brand+modello+periodo';

ALTER TABLE public.visibility_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics via brand" ON public.visibility_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.brands b 
            JOIN public.user_projects p ON b.project_id = p.id 
            WHERE b.id = brand_id AND p.user_id = auth.uid()
        )
    );

-- -------------------------------------------------------------
-- 12. SOURCE_USAGES: Tracciamento fonti citate per run
-- Collega source, brand, model, run con conteggio citazioni
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE RESTRICT,
    run_id UUID NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    
    mention_count INTEGER DEFAULT 1, -- Quante volte la fonte è citata in questa run
    context TEXT, -- Snippet del contesto in cui è citata
    is_competitor_source BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.source_usages IS 'V2: Tracciamento fonti citate nelle risposte AI';

ALTER TABLE public.source_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view source_usages via run" ON public.source_usages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_runs ar 
            JOIN public.user_projects p ON ar.project_id = p.id 
            WHERE ar.id = run_id AND p.user_id = auth.uid()
        )
    );

-- -------------------------------------------------------------
-- INDEXES per performance
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_project_id ON public.brands(project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON public.prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_topic_id ON public.prompts(topic_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_project_id ON public.analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_brand_id ON public.analysis_runs(brand_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON public.analysis_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_metrics_brand_id ON public.visibility_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_visibility_metrics_period ON public.visibility_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_source_usages_run_id ON public.source_usages(run_id);
CREATE INDEX IF NOT EXISTS idx_sources_domain ON public.sources(domain);

-- -------------------------------------------------------------
-- TRIGGER per updated_at automatico
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_projects_updated_at ON public.user_projects;
CREATE TRIGGER update_user_projects_updated_at
    BEFORE UPDATE ON public.user_projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brands_updated_at ON public.brands;
CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON public.brands
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON public.prompts;
CREATE TRIGGER update_prompts_updated_at
    BEFORE UPDATE ON public.prompts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_visibility_metrics_updated_at ON public.visibility_metrics;
CREATE TRIGGER update_visibility_metrics_updated_at
    BEFORE UPDATE ON public.visibility_metrics
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();