-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to KnowledgeSource (1536 dims = text-embedding-3-small)
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- IVFFlat index for approximate nearest-neighbor cosine search
-- lists = 100 is good for tables up to ~1M rows
CREATE INDEX IF NOT EXISTS "KnowledgeSource_embedding_idx"
  ON "KnowledgeSource"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
