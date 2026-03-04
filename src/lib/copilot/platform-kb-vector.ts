/**
 * Platform KB Vector Search
 *
 * Semantic search over PlatformKBEntry using pgvector cosine similarity.
 * Reuses the same embedding-service infrastructure used by the chatbot KB
 * (KnowledgeSource + semantic-search.ts).
 *
 * Flow:
 *  1. searchPlatformKBSemantic(): generate query embedding → pgvector <=>
 *  2. Falls back to keyword search in platform-kb.ts if no embedding / pgvector unavailable
 *
 * Seeding:
 *  indexAllPlatformKBEntries() — upserts all PLATFORM_KB entries into DB + generates embeddings
 *  Called from /api/admin/platform-kb/reindex (admin only)
 */

import { prisma } from '@/lib/prisma';
import { generateEmbedding, vectorToSql } from '@/lib/kb/embedding-service';

export interface PlatformKBSearchResult {
    id: string;
    title: string;
    content: string;
    category: string;
    keywords: string[];
    score: number;
}

/** Semantic search over PlatformKBEntry using pgvector cosine similarity */
export async function searchPlatformKBSemantic(
    query: string,
    category: string = 'all',
    topK = 5,
    minScore = 0.3
): Promise<PlatformKBSearchResult[]> {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    try {
        const vectorLiteral = vectorToSql(embedding);

        type Row = { id: string; title: string; content: string; category: string; keywords: string[]; similarity: number };

        const rows: Row[] = category === 'all'
            ? await prisma.$queryRaw<Row[]>`
                SELECT
                    id, title, content, category, keywords,
                    (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
                FROM "PlatformKBEntry"
                WHERE embedding IS NOT NULL
                  AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${minScore}
                ORDER BY embedding <=> ${vectorLiteral}::vector
                LIMIT ${topK}
              `
            : await prisma.$queryRaw<Row[]>`
                SELECT
                    id, title, content, category, keywords,
                    (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
                FROM "PlatformKBEntry"
                WHERE embedding IS NOT NULL
                  AND category = ${category}
                  AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= ${minScore}
                ORDER BY embedding <=> ${vectorLiteral}::vector
                LIMIT ${topK}
              `;

        return rows.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            category: r.category,
            keywords: r.keywords ?? [],
            score: Number(r.similarity),
        }));
    } catch (error) {
        console.warn('[platform-kb-vector] pgvector search failed:', error);
        return [];
    }
}

/** Upsert a single PlatformKBEntry + generate/store its embedding */
export async function indexPlatformKBEntry(entry: {
    id: string;
    title: string;
    content: string;
    category: string;
    keywords: string[];
}): Promise<boolean> {
    // 1. Upsert metadata row
    await prisma.platformKBEntry.upsert({
        where: { id: entry.id },
        update: { title: entry.title, content: entry.content, category: entry.category, keywords: entry.keywords },
        create: { id: entry.id, title: entry.title, content: entry.content, category: entry.category, keywords: entry.keywords }
    });

    // 2. Generate embedding
    const document = `${entry.title}\n\n${entry.content}`;
    const embedding = await generateEmbedding(document);
    if (!embedding) return false;

    const vectorLiteral = vectorToSql(embedding);

    try {
        await prisma.$executeRaw`
            UPDATE "PlatformKBEntry"
            SET embedding = ${vectorLiteral}::vector
            WHERE id = ${entry.id}
        `;
        return true;
    } catch (error) {
        console.error('[platform-kb-vector] indexPlatformKBEntry embed failed:', error);
        return false;
    }
}

/**
 * Seed / reindex all Platform KB entries.
 * Only indexes entries that don't have an embedding yet (incremental).
 * Pass force=true to reindex all entries regardless.
 */
export async function indexAllPlatformKBEntries(
    entries: Array<{ id: string; title: string; content: string; category: string; keywords: string[] }>,
    force = false
): Promise<{ total: number; indexed: number; failed: number; skipped: number }> {
    let indexed = 0;
    let failed = 0;
    let skipped = 0;

    // Find which entries already have embeddings
    const existing = force
        ? new Set<string>()
        : new Set(
            (await prisma.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM "PlatformKBEntry" WHERE embedding IS NOT NULL
            `).map(r => r.id)
        );

    for (const entry of entries) {
        if (existing.has(entry.id)) {
            skipped++;
            continue;
        }
        const ok = await indexPlatformKBEntry(entry);
        if (ok) indexed++;
        else failed++;
    }

    return { total: entries.length, indexed, failed, skipped };
}
