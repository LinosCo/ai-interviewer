-- Add missing columns to prompts table for V2 functionality
ALTER TABLE public.prompts 
ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS preferred_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'attivo' CHECK (status IN ('attivo', 'suggerito', 'inattivo'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_prompts_brand_id ON public.prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_prompts_preferred_model_id ON public.prompts(preferred_model_id);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON public.prompts(status);
CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON public.prompts(project_id);