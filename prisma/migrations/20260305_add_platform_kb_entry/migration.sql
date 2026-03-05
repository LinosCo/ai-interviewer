-- CreateTable
CREATE TABLE "PlatformKBEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformKBEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformKBEntry_category_idx" ON "PlatformKBEntry"("category");

-- Add pgvector embedding column (requires pgvector extension, which is already enabled)
ALTER TABLE "PlatformKBEntry" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- IVFFlat index for fast ANN search (built after data is loaded)
-- CREATE INDEX IF NOT EXISTS "PlatformKBEntry_embedding_idx"
--   ON "PlatformKBEntry" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
-- (Uncomment and run after seeding embeddings with /api/admin/platform-kb/reindex)
