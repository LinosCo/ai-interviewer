import { generateObject } from 'ai';
import { z } from 'zod';
import type { InterviewPlan } from './plan-types';

type RuntimePhase = 'EXPLORE' | 'DEEPEN' | 'DEEP_OFFER' | 'DATA_COLLECTION';

export interface RuntimeTopicKnowledge {
    topicId: string;
    topicLabel: string;
    interpretationCues: string[];
    significanceSignals: string[];
    probeAngles: string[];
}

export interface RuntimeInterviewKnowledge {
    version: number;
    signature: string;
    generatedAt: string;
    source: 'llm' | 'fallback';
    summary: string;
    topics: RuntimeTopicKnowledge[];
}

export interface RuntimeKnowledgeTopicInput {
    topicId: string;
    topicLabel: string;
    subGoals: string[];
}

const MANUAL_GUIDE_TITLE_HINTS = [
    'interview knowledge',
    'interview guide',
    'guida intervista',
    'conoscenza intervista',
    'research guide',
    'linee guida intervista',
    'playbook intervista'
];

function normalizeText(input: string): string {
    return String(input || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function toSentenceChunks(text: string): string[] {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map((item) => normalizeText(item))
        .filter(Boolean);
}

function hashString(input: string): string {
    let hash = 2166136261;
    for (let idx = 0; idx < input.length; idx++) {
        hash ^= input.charCodeAt(idx);
        hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function cleanItems(items: string[] | undefined, fallback: string[]): string[] {
    const candidate = Array.isArray(items) ? items : fallback;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of candidate) {
        const normalized = normalizeText(raw).slice(0, 140);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalized);
        if (out.length >= 3) break;
    }
    if (out.length === 0) {
        return fallback.map((v) => normalizeText(v)).filter(Boolean).slice(0, 2);
    }
    return out;
}

function buildFallbackTopicKnowledge(topic: RuntimeKnowledgeTopicInput, language: string): RuntimeTopicKnowledge {
    const firstSubGoal = topic.subGoals[0] || topic.topicLabel;
    const secondSubGoal = topic.subGoals[1] || topic.subGoals[0] || topic.topicLabel;
    const isItalian = language.toLowerCase().startsWith('it');

    const interpretationCues = isItalian
        ? [
            `Valuta quanto "${firstSubGoal}" è oggi strutturato o solo intuitivo.`,
            `Distinguere bisogno urgente da interesse esplorativo su "${secondSubGoal}".`
        ]
        : [
            `Assess whether "${firstSubGoal}" is structured today or mostly ad hoc.`,
            `Separate urgent needs from exploratory interest around "${secondSubGoal}".`
        ];
    const significanceSignals = isItalian
        ? [
            'Menziona impatti su decisioni, tempo o qualità delle risposte.',
            'Porta esempi concreti di frizioni, ritardi o opportunità perse.'
        ]
        : [
            'Mentions impact on decisions, response speed, or output quality.',
            'Provides concrete examples of friction, delays, or missed opportunities.'
        ];
    const probeAngles = isItalian
        ? [
            `Chiedi un caso recente in cui "${firstSubGoal}" ha inciso su una scelta.`,
            'Esplora quale risultato operativo vorrebbe vedere nei prossimi 90 giorni.'
        ]
        : [
            `Ask for a recent case where "${firstSubGoal}" affected a business decision.`,
            'Probe which operational outcome they want to see in the next 90 days.'
        ];

    return {
        topicId: topic.topicId,
        topicLabel: topic.topicLabel,
        interpretationCues: cleanItems(interpretationCues, interpretationCues),
        significanceSignals: cleanItems(significanceSignals, significanceSignals),
        probeAngles: cleanItems(probeAngles, probeAngles)
    };
}

export function buildRuntimeInterviewKnowledgeSignature(params: {
    language: string;
    researchGoal?: string | null;
    targetAudience?: string | null;
    plan: InterviewPlan;
}): string {
    const basis = [
        params.language || 'en',
        params.researchGoal || '',
        params.targetAudience || '',
        params.plan?.meta?.topicsSignature || '',
        params.plan?.meta?.maxDurationMins || ''
    ].join('|');
    return `rk-v1-${hashString(basis)}`;
}

export function extractManualInterviewGuideSource(
    sources: Array<{ type?: string | null; title?: string | null; content?: string | null }> | null | undefined
): string | null {
    if (!Array.isArray(sources) || sources.length === 0) return null;

    const scored = sources
        .map((source) => {
            const title = normalizeText(source.title || '').toLowerCase();
            const type = normalizeText(source.type || '').toLowerCase();
            const content = normalizeText(source.content || '');
            let score = 0;
            if (!content) return { score: -1, content: '' };
            if (type.includes('interview')) score += 4;
            for (const hint of MANUAL_GUIDE_TITLE_HINTS) {
                if (title.includes(hint)) {
                    score += 3;
                    break;
                }
            }
            if (title.includes('guide') || title.includes('guida') || title.includes('knowledge') || title.includes('conoscenza')) {
                score += 1;
            }
            if (content.length >= 200) score += 1;
            return { score, content };
        })
        .sort((a, b) => b.score - a.score);

    if (!scored.length || scored[0].score < 0) return null;
    const best = scored[0].content.slice(0, 2200);
    return best || null;
}

export function buildFallbackRuntimeInterviewKnowledge(params: {
    signature: string;
    language: string;
    interviewGoal?: string;
    topics: RuntimeKnowledgeTopicInput[];
}): RuntimeInterviewKnowledge {
    const isItalian = params.language.toLowerCase().startsWith('it');
    const summary = isItalian
        ? `Sintesi: usa i topic per distinguere bisogni immediati, impatti decisionali e priorità di adozione AI${params.interviewGoal ? ` rispetto a "${normalizeText(params.interviewGoal).slice(0, 120)}"` : ''}.`
        : `Summary: use topics to separate immediate needs, decision impact, and AI adoption priorities${params.interviewGoal ? ` against "${normalizeText(params.interviewGoal).slice(0, 120)}"` : ''}.`;
    return {
        version: 1,
        signature: params.signature,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        summary: normalizeText(summary).slice(0, 280),
        topics: params.topics.map((topic) => buildFallbackTopicKnowledge(topic, params.language))
    };
}

export function isRuntimeInterviewKnowledgeValid(
    input: unknown,
    expectedSignature: string
): input is RuntimeInterviewKnowledge {
    if (!input || typeof input !== 'object') return false;
    const obj = input as RuntimeInterviewKnowledge;
    if (obj.version !== 1) return false;
    if (obj.signature !== expectedSignature) return false;
    if (!Array.isArray(obj.topics) || obj.topics.length === 0) return false;
    return true;
}

export async function generateRuntimeInterviewKnowledge(params: {
    model: unknown;
    signature: string;
    language: string;
    interviewGoal?: string;
    targetAudience?: string;
    topics: RuntimeKnowledgeTopicInput[];
    timeoutMs?: number;
    onUsage?: (payload: {
        source: string;
        model?: string | null;
        usage?: {
            inputTokens?: number | null;
            outputTokens?: number | null;
            totalTokens?: number | null;
        } | null;
    }) => void;
}): Promise<RuntimeInterviewKnowledge> {
    const fallback = buildFallbackRuntimeInterviewKnowledge({
        signature: params.signature,
        language: params.language,
        interviewGoal: params.interviewGoal,
        topics: params.topics
    });

    if (!params.topics.length) return fallback;

    const schema = z.object({
        summary: z.string().min(12).max(280),
        topics: z.array(z.object({
            topicId: z.string().min(1),
            topicLabel: z.string().min(1),
            interpretationCues: z.array(z.string().min(4).max(140)).min(1).max(3),
            significanceSignals: z.array(z.string().min(4).max(140)).min(1).max(3),
            probeAngles: z.array(z.string().min(4).max(140)).min(1).max(3)
        })).min(1)
    });

    const topicsForPrompt = params.topics
        .map((t, idx) => `${idx + 1}) ${t.topicId} | ${t.topicLabel} | sub-goals: ${(t.subGoals || []).join(' ; ') || '-'}`)
        .join('\n');

    const prompt = [
        `Language: ${params.language}`,
        `Task: Build compact interviewer intelligence notes for a qualitative interview.`,
        `Interview goal: ${params.interviewGoal || '-'}`,
        `Target audience: ${params.targetAudience || '-'}`,
        `Topics:`,
        topicsForPrompt,
        ``,
        `Output constraints:`,
        `- Keep it practical, non-generic, and tied to business decisions.`,
        `- For each topic provide:`,
        `  1) interpretationCues -> how to read user answers`,
        `  2) significanceSignals -> signs that deserve deeper probing`,
        `  3) probeAngles -> follow-up directions with concrete business framing`,
        `- Max 3 short bullets per list.`,
        `- Do NOT include markdown, numbering, or commentary outside JSON.`
    ].join('\n');

    try {
        const timeoutMs = Math.max(600, Math.min(params.timeoutMs ?? 1400, 2400));
        const result = await Promise.race([
            generateObject({
                model: params.model as never,
                schema,
                prompt,
                temperature: 0.25
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RUNTIME_KNOWLEDGE_TIMEOUT')), timeoutMs))
        ]);
        params.onUsage?.({
            source: 'runtime_interview_knowledge',
            model: typeof (params.model as any)?.modelId === 'string' ? (params.model as any).modelId : null,
            usage: (result as any)?.usage
        });

        const byId = new Map<string, RuntimeTopicKnowledge>();
        for (const item of result.object.topics || []) {
            byId.set(item.topicId, {
                topicId: item.topicId,
                topicLabel: normalizeText(item.topicLabel).slice(0, 80) || item.topicId,
                interpretationCues: cleanItems(item.interpretationCues, []),
                significanceSignals: cleanItems(item.significanceSignals, []),
                probeAngles: cleanItems(item.probeAngles, [])
            });
        }

        const mergedTopics = params.topics.map((topic) => {
            const generated = byId.get(topic.topicId);
            if (!generated) return buildFallbackTopicKnowledge(topic, params.language);
            return {
                topicId: topic.topicId,
                topicLabel: generated.topicLabel || topic.topicLabel,
                interpretationCues: cleanItems(generated.interpretationCues, buildFallbackTopicKnowledge(topic, params.language).interpretationCues),
                significanceSignals: cleanItems(generated.significanceSignals, buildFallbackTopicKnowledge(topic, params.language).significanceSignals),
                probeAngles: cleanItems(generated.probeAngles, buildFallbackTopicKnowledge(topic, params.language).probeAngles)
            };
        });

        return {
            version: 1,
            signature: params.signature,
            generatedAt: new Date().toISOString(),
            source: 'llm',
            summary: normalizeText(result.object.summary).slice(0, 280),
            topics: mergedTopics
        };
    } catch {
        return fallback;
    }
}

export function buildRuntimeKnowledgePromptBlock(params: {
    knowledge: RuntimeInterviewKnowledge | null;
    phase: RuntimePhase;
    targetTopicId?: string | null;
    language: string;
}): string {
    if (!params.knowledge) return '';
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') return '';
    const topic = params.knowledge.topics.find((item) => item.topicId === params.targetTopicId) || params.knowledge.topics[0];
    if (!topic) return '';

    const cueLine = topic.interpretationCues.slice(0, 2).join(' | ');
    const signalLine = topic.significanceSignals.slice(0, 2).join(' | ');
    const probeLine = topic.probeAngles.slice(0, 2).join(' | ');
    const isItalian = params.language.toLowerCase().startsWith('it');

    if (isItalian) {
        return `
## RUNTIME TOPIC INTELLIGENCE
- Sintesi: ${params.knowledge.summary}
- Topic attivo: "${topic.topicLabel}"
- Cosa interpretare: ${cueLine}
- Segnali da approfondire: ${signalLine}
- Direzioni di probing: ${probeLine}
Usa questi spunti in modo naturale, senza elencarli all'utente.
`.trim();
    }

    return `
## RUNTIME TOPIC INTELLIGENCE
- Summary: ${params.knowledge.summary}
- Active topic: "${topic.topicLabel}"
- Interpretation cues: ${cueLine}
- Signals worth deepening: ${signalLine}
- Probing directions: ${probeLine}
Use these cues naturally without listing them to the interviewee.
`.trim();
}

export function buildManualKnowledgePromptBlock(params: {
    manualGuide: string | null;
    phase: RuntimePhase;
    language: string;
    topicLabel: string;
    topicSubGoals?: string[];
}): string {
    if (!params.manualGuide) return '';
    if (params.phase !== 'EXPLORE' && params.phase !== 'DEEPEN') return '';

    const guideSentences = toSentenceChunks(params.manualGuide);
    if (!guideSentences.length) return '';

    const topicTokens = normalizeText(
        `${params.topicLabel} ${(params.topicSubGoals || []).join(' ')}`
    )
        .toLowerCase()
        .split(' ')
        .filter((token) => token.length >= 4);
    const tokenSet = new Set(topicTokens);

    const scored = guideSentences
        .map((sentence) => {
            const sentenceTokens = new Set(sentence.toLowerCase().split(' ').filter((token) => token.length >= 4));
            let overlap = 0;
            for (const token of tokenSet) {
                if (sentenceTokens.has(token)) overlap++;
            }
            return { sentence, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap);

    const selected = scored
        .filter((item) => item.overlap > 0)
        .slice(0, 3)
        .map((item) => item.sentence);
    const fallback = guideSentences.slice(0, 2);
    const lines = (selected.length > 0 ? selected : fallback).slice(0, 3);

    const isItalian = params.language.toLowerCase().startsWith('it');
    if (isItalian) {
        return `
## KNOWLEDGE GUIDA INTERVISTA (MANUALE, EDITABILE)
Per il topic "${params.topicLabel}" tieni presente:
- ${lines.join('\n- ')}
Usa questa guida come prioritaria e applicala in modo naturale.
`.trim();
    }

    return `
## INTERVIEW GUIDE KNOWLEDGE (MANUAL, EDITABLE)
For topic "${params.topicLabel}" keep in mind:
- ${lines.join('\n- ')}
Treat this guide as primary and apply it naturally.
`.trim();
}
