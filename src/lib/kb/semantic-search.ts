/**
 * KB Semantic Search
 *
 * Provides vector-similarity search over KnowledgeSource entries using
 * pgvector's cosine distance operator (<=>).
 *
 * Falls back to keyword-based search when:
 * - pgvector extension is not available
 * - The query or KB entries have no embeddings yet
 * - OpenAI API key is not configured
 */

import { prisma } from '@/lib/prisma';
import { generateEmbedding, buildKBDocument, vectorToSql } from './embedding-service';

export interface KBSearchResult {
    id: string;
    title: string | null;
    content: string;
    type: string;
    score: number; // 0-1, higher = more relevant (cosine similarity)
}

/**
 * Search knowledge sources for a bot using semantic (vector) similarity.
 *
 * @param botId    - bot whose KB to search
 * @param query    - the user's question or conversation snippet
 * @param topK     - max results to return (default 5)
 * @param minScore - minimum cosine similarity threshold (default 0.3)
 */
export async function searchKnowledgeSources(
    botId: string,
    query: string,
    topK = 5,
    minScore = 0.3
): Promise<KBSearchResult[]> {
    // 1. Try semantic search
    const embedding = await generateEmbedding(query);
    if (embedding) {
        const results = await semanticSearch(botId, embedding, topK, minScore);
        if (results.length > 0) return results;
    }

    // 2. Fallback to keyword search
    return keywordSearch(botId, query, topK);
}

/** pgvector cosine similarity search via raw SQL */
async function semanticSearch(
    botId: string,
    queryEmbedding: number[],
    topK: number,
    minScore: number
): Promise<KBSearchResult[]> {
    try {
        const vectorLiteral = vectorToSql(queryEmbedding);

        // 1 - cosine_distance = cosine_similarity
        const rows = await prisma.$queryRaw<Array<{
            id: string;
            title: string | null;
            content: string;
            type: string;
            similarity: number;
        }>>`
            SELECT
                id,
                title,
                content,
                type,
                (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
            FROM "KnowledgeSource"
            WHERE "botId" = ${botId}
              AND embedding IS NOT NULL
              AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${minScore}
            ORDER BY embedding <=> ${vectorLiteral}::vector
            LIMIT ${topK}
        `;

        return rows.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            type: r.type,
            score: Number(r.similarity),
        }));
    } catch (error) {
        // pgvector not installed or column missing — fall through to keyword
        console.warn('[semantic-search] Vector search failed (pgvector unavailable?):', error);
        return [];
    }
}

/** Simple keyword fallback (TF-IDF-lite) */
function keywordSearch(
    botId: string,
    query: string,
    topK: number
): Promise<KBSearchResult[]> {
    return prisma.knowledgeSource.findMany({
        where: { botId },
        select: { id: true, title: true, content: true, type: true },
    }).then(sources => {
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        const scored = sources.map(s => {
            const text = `${s.title ?? ''} ${s.content}`.toLowerCase();
            const score = queryWords.reduce((acc, word) => {
                const count = (text.match(new RegExp(word, 'g')) ?? []).length;
                return acc + count;
            }, 0);
            return { ...s, score: Math.min(1, score / 20) };
        });

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(s => ({ id: s.id, title: s.title, content: s.content, type: s.type, score: s.score }));
    });
}

/**
 * Generate and persist an embedding for a single KnowledgeSource.
 * Called when a KB entry is created or updated.
 */
export async function indexKnowledgeSource(
    id: string,
    title: string | null,
    content: string
): Promise<boolean> {
    const document = buildKBDocument(title, content);
    const embedding = await generateEmbedding(document);
    if (!embedding) return false;

    const vectorLiteral = vectorToSql(embedding);

    try {
        await prisma.$executeRaw`
            UPDATE "KnowledgeSource"
            SET embedding = ${vectorLiteral}::vector
            WHERE id = ${id}
        `;
        return true;
    } catch (error) {
        console.error('[semantic-search] indexKnowledgeSource failed:', error);
        return false;
    }
}

/**
 * Backfill embeddings for all KnowledgeSource entries that lack one.
 * Called from the /api/kb/reindex admin endpoint.
 *
 * Returns { total, indexed, failed }.
 */
export async function reindexAllKnowledgeSources(
    botId?: string
): Promise<{ total: number; indexed: number; failed: number }> {
    // Raw SQL because Prisma can't filter on Unsupported("vector") columns
    const rows = botId
        ? await prisma.$queryRaw<Array<{ id: string; title: string | null; content: string }>>`
            SELECT id, title, content FROM "KnowledgeSource"
            WHERE embedding IS NULL AND "botId" = ${botId}
          `
        : await prisma.$queryRaw<Array<{ id: string; title: string | null; content: string }>>`
            SELECT id, title, content FROM "KnowledgeSource"
            WHERE embedding IS NULL
          `;

    let indexed = 0;
    let failed = 0;

    for (const row of rows) {
        const ok = await indexKnowledgeSource(row.id, row.title, row.content);
        if (ok) indexed++; else failed++;
    }

    return { total: rows.length, indexed, failed };
}
