-- Alter confidence_score to handle values up to 100
ALTER TABLE public.analysis_runs 
ALTER COLUMN confidence_score TYPE numeric(5,2);