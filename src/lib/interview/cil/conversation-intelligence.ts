import { generateObject } from 'ai';
import { z } from 'zod';
import type { CILAnalysis, CILState } from './types';
import type { RuntimeTopicKnowledge } from '@/lib/interview/runtime-knowledge';

export interface GenerateCILAnalysisParams {
    recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>;
    currentTopicId: string;
    cilState: CILState;
    topicKnowledge: RuntimeTopicKnowledge | null;
    model: unknown;
    language: string;
}

const CIL_TIMEOUT_MS = 4000;

const cilAnalysisSchema = z.object({
    openThreads: z.array(z.object({
        description: z.string().max(200),
        sourceTopicId: z.string(),
        strength: z.enum(['high', 'medium']),
        turnIndex: z.number(),
        anchoredHypothesis: z.string().optional()
    })).max(4),
    emergingThemes: z.array(z.string().max(100)).max(3),
    lastResponseAnalysis: z.object({
        keySignals: z.array(z.string().max(100)).max(5),
        emotionalCues: z.array(z.string().max(100)).max(3),
        interruptedThoughts: z.array(z.string().max(100)).max(3),
        activeHypotheses: z.array(z.string().max(100)).max(3),
        contradictionFlags: z.array(z.string().max(100)).max(3),
    }),
    suggestedMove: z.enum(['probe_deeper', 'follow_thread', 'bridge', 'synthesize']),
    budgetSignal: z.object({
        extend: z.boolean(),
        topicId: z.string(),
        reason: z.string().max(200),
    }).nullable()
});

function buildCILPrompt(params: GenerateCILAnalysisParams): string {
    const { topicKnowledge, cilState, recentTurns, currentTopicId, language } = params;
    const lang = language === 'it' ? 'Italian' : 'English';

    const knowledgeSection = topicKnowledge ? `
== TOPIC INTELLIGENCE (pre-computed) ==
Topic: ${topicKnowledge.topicLabel}
Hypotheses: ${(topicKnowledge.hypotheses || []).join(' | ') || 'none'}
Narrative threads: ${(topicKnowledge.narrativeThreads || []).join(' | ') || 'none'}
Contradiction flags: ${(topicKnowledge.contradictionFlags || []).join(' | ') || 'none'}
Emotional signals: ${(topicKnowledge.emotionalSignals || []).join(' | ') || 'none'}
Probe angles: ${topicKnowledge.probeAngles.join(' | ')}
Significance signals: ${topicKnowledge.significanceSignals.join(' | ')}
` : '== NO TOPIC INTELLIGENCE AVAILABLE ==';

    const accumulatedSection = cilState.openThreads.length > 0 ? `
== ACCUMULATED THREADS ==
${cilState.openThreads.map(t => `[${t.strength.toUpperCase()}] ${t.description}`).join('\n')}

Emerging themes: ${cilState.emergingThemes.join(', ') || 'none'}
` : '';

    const conversationSection = `
== RECENT CONVERSATION (last ${recentTurns.length} turns) ==
${recentTurns.map(t => `${t.role === 'user' ? 'CANDIDATE' : 'INTERVIEWER'}: ${t.content}`).join('\n\n')}
`;

    return `You are a qualitative interview analyst. Language: ${lang}.
Current topic ID: ${currentTopicId}
${knowledgeSection}
${accumulatedSection}
${conversationSection}

Analyze the CANDIDATE's latest message and return a JSON analysis:
- openThreads: new threads worth following (max 4; strength=high only if genuinely surprising or hypothesis-confirming)
- emergingThemes: new cross-topic patterns (max 3)
- lastResponseAnalysis: key signals, emotional cues, interrupted thoughts, active hypotheses, contradiction flags from the latest candidate message
- suggestedMove: probe_deeper (follow current thread) | follow_thread (pursue open thread) | bridge (natural transition) | synthesize (connect patterns)
- budgetSignal: set extend=true + topicId only if a HIGH-strength thread justifies staying longer on this topic; otherwise null

Be specific, non-generic, grounded in what was actually said.`;
}

function makeEmptyAnalysis(): CILAnalysis {
    return {
        openThreads: [],
        emergingThemes: [],
        lastResponseAnalysis: {
            keySignals: [],
            emotionalCues: [],
            interruptedThoughts: [],
            activeHypotheses: [],
            contradictionFlags: []
        },
        suggestedMove: 'probe_deeper',
        budgetSignal: null
    };
}

export async function generateCILAnalysis(params: GenerateCILAnalysisParams): Promise<CILAnalysis> {
    if (params.recentTurns.length === 0) return makeEmptyAnalysis();

    try {
        const result = await Promise.race([
            generateObject({
                model: params.model as never,
                schema: cilAnalysisSchema,
                prompt: buildCILPrompt(params),
                temperature: 0.2
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('CIL timeout')), CIL_TIMEOUT_MS)
            )
        ]);
        return (result as any).object as CILAnalysis;
    } catch {
        // CIL failure is non-fatal — return empty analysis, interview continues
        return makeEmptyAnalysis();
    }
}
