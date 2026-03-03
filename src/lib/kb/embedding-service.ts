/**
 * Embedding Service
 *
 * Generates text embeddings using OpenAI text-embedding-3-small (1536 dims).
 * Falls back gracefully when the API key is not configured.
 *
 * Used by the KB semantic search layer to embed knowledge source content
 * and user queries at retrieval time.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
const MAX_CONTENT_CHARS = 8000; // ~2000 tokens, well within model limit

/** Generate a single embedding vector for a text string */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[embedding-service] OPENAI_API_KEY not set — skipping embedding');
        return null;
    }

    // Truncate to avoid hitting the model's context limit
    const truncated = text.slice(0, MAX_CONTENT_CHARS);

    try {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: truncated,
                dimensions: EMBEDDING_DIMS,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI embeddings API error ${res.status}: ${err}`);
        }

        const data = await res.json() as {
            data: Array<{ embedding: number[] }>;
        };

        return data.data[0].embedding;
    } catch (error) {
        console.error('[embedding-service] generateEmbedding failed:', error);
        return null;
    }
}

/** Embed a knowledge source for DB storage: combines title + content */
export function buildKBDocument(title: string | null, content: string): string {
    const parts: string[] = [];
    if (title) parts.push(title);
    parts.push(content);
    return parts.join('\n\n');
}

/** Format a vector array as PostgreSQL vector literal: '[0.1,0.2,...]' */
export function vectorToSql(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
}

export { EMBEDDING_DIMS };
