import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnippetRecommendedFormat = 'paragraph' | 'numbered_list' | 'table' | 'definition';

export interface FeaturedSnippetOpportunity {
    query: string;
    currentPosition: number;
    impressions: number;
    clicks: number;
    ctr: number;
    recommendedFormat: SnippetRecommendedFormat;
    rationale: string;
}

export type CitationFormatType =
    | 'authoritative_definition'
    | 'data_table'
    | 'structured_qa'
    | 'numbered_guide';

export interface CitationFormat {
    type: CitationFormatType;
    title: string;
    description: string;
    templateHint: string;
}

export interface CitationBuildingResult {
    topic: string;
    formats: CitationFormat[];
    contentPrinciples: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawSearchQuery {
    query: string;
    impressions: number;
    clicks: number;
    position: number;
    ctr: number;
}

function isRawSearchQuery(value: unknown): value is RawSearchQuery {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj['query'] === 'string' &&
        typeof obj['impressions'] === 'number' &&
        typeof obj['clicks'] === 'number' &&
        typeof obj['position'] === 'number' &&
        typeof obj['ctr'] === 'number'
    );
}

function inferRecommendedFormat(query: string): { format: SnippetRecommendedFormat; rationale: string } {
    const q = query.toLowerCase().trim();

    if (/^(come|how|steps|procedura)\b/.test(q)) {
        return {
            format: 'numbered_list',
            rationale: 'Le query "come / how-to" beneficiano di liste numerate step-by-step per conquistare il Featured Snippet.'
        };
    }

    if (/^(cosa|what is|cos'?è|definizione|significato)\b/.test(q)) {
        return {
            format: 'definition',
            rationale: 'Le query definitorie ottengono snippet di tipo "definition box": risposta diretta in 40-60 parole.'
        };
    }

    if (/\b(confronto|vs|versus|comparison|differenza)\b/.test(q)) {
        return {
            format: 'table',
            rationale: 'Le query comparative favoriscono tabelle HTML che Google può estrarre come snippet tabellare.'
        };
    }

    return {
        format: 'paragraph',
        rationale: 'Un paragrafo conciso (40-60 parole) con la risposta nella prima frase è il formato ottimale per questo tipo di query.'
    };
}

// ---------------------------------------------------------------------------
// Public: Featured Snippet Opportunities
// ---------------------------------------------------------------------------

export async function getFeaturedSnippetOpportunities(
    organizationId: string,
    projectId?: string | null,
    limit = 10
): Promise<FeaturedSnippetOpportunity[]> {
    const effectiveLimit = Math.min(Math.max(1, Math.floor(limit)), 20);

    // Build where clause: GoogleConnection links via projectId → Project → organizationId
    const connections = await prisma.googleConnection.findMany({
        where: projectId
            ? { projectId }
            : { project: { organizationId } },
        include: {
            analytics: {
                orderBy: { date: 'desc' },
                take: 30, // look at recent data windows
                select: { topSearchQueries: true }
            }
        }
    });

    const opportunityMap = new Map<string, FeaturedSnippetOpportunity>();

    for (const connection of connections) {
        for (const analyticsRow of connection.analytics) {
            const raw: unknown = analyticsRow.topSearchQueries;
            if (!Array.isArray(raw)) continue;

            for (const entry of raw) {
                if (!isRawSearchQuery(entry)) continue;

                // Filter: positions 4–20, at least 100 impressions
                if (entry.position < 4 || entry.position > 20) continue;
                if (entry.impressions < 100) continue;

                // Deduplicate by query; prefer highest-impression record
                const existing = opportunityMap.get(entry.query);
                if (existing && existing.impressions >= entry.impressions) continue;

                const { format, rationale } = inferRecommendedFormat(entry.query);

                opportunityMap.set(entry.query, {
                    query: entry.query,
                    currentPosition: entry.position,
                    impressions: entry.impressions,
                    clicks: entry.clicks,
                    ctr: entry.ctr,
                    recommendedFormat: format,
                    rationale
                });
            }
        }
    }

    const sorted = Array.from(opportunityMap.values()).sort(
        (a, b) => b.impressions - a.impressions
    );

    return sorted.slice(0, effectiveLimit);
}

// ---------------------------------------------------------------------------
// Public: Citation Building Recommendations
// ---------------------------------------------------------------------------

const CONTENT_PRINCIPLES: string[] = [
    'Usa definizioni concise e autorevoli (max 2 frasi per risposta diretta)',
    'Includi dati numerici verificabili con fonte citata',
    'Struttura le risposte in formato Q&A esplicito',
    'Usa heading HTML semantici (H2 per domande, H3 per sotto-argomenti)',
    'Aggiungi markup Schema.org FAQ o HowTo per le sezioni strutturate'
];

export function getCitationBuildingRecommendations(
    topic: string,
    brandName?: string
): CitationBuildingResult {
    const topicLabel = topic.trim() || 'contenuto del sito';
    const brandSuffix = brandName ? ` di ${brandName}` : '';

    const formats: CitationFormat[] = [
        {
            type: 'authoritative_definition',
            title: `Definizione autorevole: "${topicLabel}"`,
            description:
                'Una definizione sintetica e autorevole è la struttura più citata dagli LLM come fonte primaria. Deve rispondere in modo diretto, senza ambiguità.',
            templateHint:
                `Inizia con "[Topic] è [definizione in 1 frase]${brandSuffix}. [Frase di approfondimento con caratteristica distintiva]." Mantieni la risposta sotto le 60 parole.`
        },
        {
            type: 'data_table',
            title: `Tabella dati: confronto e statistiche su "${topicLabel}"`,
            description:
                'Le tabelle con dati numerici e comparativi vengono estratte spesso come snippet tabellari da Google e citate dagli LLM per la loro precisione.',
            templateHint:
                `Crea una tabella HTML con intestazioni chiare (es. Caratteristica | Valore | Fonte). Includi almeno 5 righe con dati verificabili su ${topicLabel}.`
        },
        {
            type: 'structured_qa',
            title: `Q&A strutturate su "${topicLabel}"`,
            description:
                'Il formato domanda-risposta esplicito (H2 per domanda, risposta diretta nel primo paragrafo) è ideale per FAQ Schema.org e per la citazione da parte di chatbot AI.',
            templateHint:
                `Per ogni domanda usa H2 con testo interrogativo, poi nella prima frase rispondi direttamente. Aggiungi markup schema FAQPage. Punta a 5-10 coppie Q&A su aspetti distinti di ${topicLabel}.`
        },
        {
            type: 'numbered_guide',
            title: `Guida numerata: come fare con "${topicLabel}"`,
            description:
                'Le guide step-by-step con liste numerate conquistano i Featured Snippet "how-to" e vengono citate dagli LLM quando gli utenti chiedono procedure.',
            templateHint:
                `Struttura: H2 "Come [fare X con ${topicLabel}]", poi lista <ol> con 5-8 passi. Ogni passo: verbo all'imperativo + azione concreta${brandSuffix}. Aggiungi markup HowTo Schema.org.`
        }
    ];

    return {
        topic: topicLabel,
        formats,
        contentPrinciples: CONTENT_PRINCIPLES
    };
}
