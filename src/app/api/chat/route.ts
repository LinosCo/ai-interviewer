
import { ChatService } from '@/services/chat-service';
import { generateObject, generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder, addValidationFeedbackToPrompt } from '@/lib/llm/prompt-builder';
import { LLMService, type InterviewRuntimeModels } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { getConfigValue } from '@/lib/config';
import { getOrCreateInterviewPlan } from '@/lib/interview/plan-service';
import type { InterviewPlan } from '@/lib/interview/plan-types';
import { buildTopicAnchors, buildMessageAnchors, responseMentionsAnchors } from '@/lib/interview/topic-anchors';
import { getNextMissingCandidateField } from '@/lib/interview/flow-guards';
import { validateExtractedField } from '@/lib/interview/field-validation';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { getCompletionGuardAction, shouldInterceptDeepOfferClosure, shouldInterceptTopicPhaseClosure } from '@/lib/interview/phase-flow';
// NOTE: v2 post-processing moved to post-processing-v2.ts - quality gates removed
import { extractDeterministicFieldValue, normalizeCandidateFieldIds } from '@/lib/interview/data-collection-guard';
import { createDefaultSupervisorInsight, runDeepOfferPhase, type InterviewStateLike, type Phase, type SupervisorInsight, type TransitionMode } from '@/lib/interview/interview-supervisor';
import type { ValidationResponse } from '@/lib/interview/validation-response';
import { findDuplicateQuestionMatch } from '@/lib/interview/question-dedup';
import { handleExplorePhase, handleDeepenPhase } from '@/lib/interview/explore-deepen-machine';
import { computeSignalScore } from '@/lib/interview/signal-score';
import { buildContextualDeepOfferInsight } from '@/lib/interview/deep-offer-context';
import { buildTurnGuidanceBlock, buildGuardsBlock } from '@/lib/llm/runtime-prompt-blocks';
import { buildTopicTurnDecision, type TopicTurnDecision } from '@/lib/interview/turn-decision';
import { runPostProcessing } from '@/lib/interview/post-processing-v2';
import {
    buildFallbackRuntimeInterviewKnowledge,
    buildManualKnowledgePromptBlock,
    buildRuntimeInterviewKnowledgeSignature,
    buildRuntimeKnowledgePromptBlock,
    extractManualInterviewGuideSource,
    generateRuntimeInterviewKnowledge,
    isRuntimeInterviewKnowledgeValid,
    type RuntimeInterviewKnowledge
} from '@/lib/interview/runtime-knowledge';
import {
    buildMicroPlannerDecision,
    buildMicroPlannerPromptBlock
} from '@/lib/interview/micro-planner';
import { generateCILAnalysis } from '@/lib/interview/cil/conversation-intelligence';
import { mergeCILState, EMPTY_CIL_STATE } from '@/lib/interview/cil/cil-state';
import { computeCILBonusCap, applyCILBudgetSignal } from '@/lib/interview/explore-deepen-machine';
import { buildCILContextBlock } from '@/lib/llm/prompt-builder';
import type { CILAnalysis, CILState } from '@/lib/interview/cil/types';

import {
    InterestingTopic, TopicBudget,
    extractSnippet, computeEngagementScore, shouldUseCriticalModelForTopicTurn,
    ITALIAN_STOPWORDS, ENGLISH_STOPWORDS, tokenizeForScoring, lexicalOverlapScore,
    buildTopicSemanticText, getDeepTopics, buildDeepTopicOrder,
    getScanPlanTurns, getDeepPlanTurns, getRemainingSubGoals,
    buildDeepPlan, selectDeepFocusPoint,
    sanitizeUserSnippet, detectFatigue,
} from '@/lib/chat/context-helpers';
import {
    generateConsentQuestionOnly, generateFieldQuestionOnly,
    extractLastAssistantQuestion, buildUserBridgeHint,
    buildRuntimeSemanticContextPrompt,
    normalizeSingleQuestion,
    collectRecentBridgeStems,
    buildNaturalTopicCue,
    type UserTurnSignal,
} from '@/lib/chat/response-builder';
import {
    checkUserIntent,
    evaluateDataCollectionUserTurn,
    evaluateAssistantTurn,
    evaluateTopicalUserTurn,
    isAssistantExtensionOffer,
    type AssistantTurnEvaluation,
    type DataCollectionTurnInterpretation,
    type LLMUsageCollector,
    type LLMUsagePayload,
} from '@/lib/interview/chat-intent';
import {
    StructuredInterviewSubmissionSchema,
    buildDataCollectionInteractionPayload,
    type InterviewInteractionPayload,
    type StructuredInterviewSubmission,
} from '@/lib/interview/structured-interactions';
import {
    generateQuestionOnly,
    generateDeepOfferOnly,
    enforceDeepOfferQuestion,
} from '@/lib/interview/question-generator';
import { completeInterview } from '@/lib/interview/interview-completion';
import { alignStateWithCompletionGuard } from '@/lib/interview/completion-guard-alignment';
import { ToneAnalyzer } from '@/lib/tone/tone-analyzer';
import { buildToneAdaptationPrompt } from '@/lib/tone/tone-prompt-adapter';
import { getTierConfig } from '@/config/interview-tiers';
export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
    SAFETY_MAX_ASSISTANT_TURNS: 120,
    SAFETY_MAX_TOTAL_MESSAGES: 260,
};
const SOFT_STATE_ENRICHMENT_WAIT_MS = 40;
const ENABLE_SOFT_QUALITY_GUARDS = false;
const ENABLE_NON_HARD_SAFETY_REGENERATIONS = false;
type InterviewAbVariant = 'control' | 'treatment';

function buildPromptCILAnalysis(cilState: CILState | null | undefined): CILAnalysis | null {
    if (!cilState) return null;
    const hasThreads = Array.isArray(cilState.openThreads) && cilState.openThreads.length > 0;
    const hasThemes = Array.isArray(cilState.emergingThemes) && cilState.emergingThemes.length > 0;
    const lastResponseAnalysis = cilState.lastResponseAnalysis ?? {
        keySignals: [],
        emotionalCues: [],
        interruptedThoughts: [],
        activeHypotheses: [],
        contradictionFlags: []
    };
    const hasLastResponseSignals =
        lastResponseAnalysis.keySignals.length > 0 ||
        lastResponseAnalysis.emotionalCues.length > 0 ||
        lastResponseAnalysis.interruptedThoughts.length > 0 ||
        lastResponseAnalysis.activeHypotheses.length > 0 ||
        lastResponseAnalysis.contradictionFlags.length > 0;

    if (!hasThreads && !hasThemes && !hasLastResponseSignals) {
        return null;
    }

    return {
        openThreads: cilState.openThreads,
        emergingThemes: cilState.emergingThemes,
        lastResponseAnalysis,
        suggestedMove: 'probe_deeper',
        budgetSignal: null
    };
}

async function resolveWithin<T>(promise: Promise<T> | null | undefined, timeoutMs: number): Promise<T | null> {
    if (!promise) return null;
    try {
        return await Promise.race([
            promise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
        ]);
    } catch {
        return null;
    }
}

function isLocalSimulationRequest(req: Request): boolean {
    const simulateHeader = req.headers.get('x-chat-simulate');
    if (simulateHeader !== '1') return false;
    if (process.env.NODE_ENV === 'production') return false;
    const host = (req.headers.get('host') || '').toLowerCase();
    return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}

// ============================================================================
// TYPES
// ============================================================================
export interface InterviewState {
    phase: Phase;
    topicIndex: number;
    turnInTopic: number;
    deepAccepted: boolean | null;   // null = not asked yet
    consentGiven: boolean | null;   // null = not asked yet
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    fieldAttemptCounts: Record<string, number>;  // Track attempts per field to prevent loops
    closureAttempts: number;        // Track consecutive closure attempts to prevent infinite loops
    dataCollectionRefused?: boolean;
    forceConsentQuestion?: boolean;
    interestingTopics?: InterestingTopic[];

    // v2: Elastic turn budget tracking
    topicBudgets: Record<string, TopicBudget>;
    turnsUsedTotal: number;
    turnsBudgetTotal: number;
    uncoveredTopics: string[];  // Topic IDs with remaining subgoals
    topicEngagementScores: Record<string, number>;  // Signal scores per topic
    topicKeyInsights: Record<string, string>;  // Best snippet per topic
    lastSignalScore: number;  // Last computed signal score (0-1)

    // Legacy DEEP fields (being phased out)
    deepTopicOrder?: string[];             // Ordered topic IDs for DEEP based on value
    deepTurnsByTopic?: Record<string, number>;
    topicSubGoalHistory?: Record<string, string[]>; // Track used sub-goals per topic
    lastUserTopicId?: string | null;
    deepLastSubGoalByTopic?: Record<string, string>;
    clarificationTurnsByTopic?: Record<string, number>;
    extensionReturnPhase?: 'EXPLORE' | 'DEEPEN' | null;
    extensionReturnTopicIndex?: number | null;
    extensionReturnTurnInTopic?: number | null;
    extensionOfferAttempts?: number;
    deepTurnBudgetRemaining?: number | null;
    runtimeInterviewKnowledge?: RuntimeInterviewKnowledge | null;
    runtimeInterviewKnowledgeSignature?: string | null;
    cilState?: CILState | null;
    activeInteractionId?: string | null;
    activeInteractionKind?: InterviewInteractionPayload['kind'] | null;
    activeInteractionFieldId?: string | null;
}

interface QualityTelemetry {
    eligible: boolean;
    evaluated: boolean;
    score: number | null;
    passed: boolean | null;
    gateTriggered: boolean;
    regenerated: boolean;
    fallbackUsed: boolean;
    issues: string[];
}

interface FlowGuardTelemetry {
    topicClosureIntercepted: boolean;
    deepOfferClosureIntercepted: boolean;
    completionGuardIntercepted: boolean;
    completionBlockedForConsent: boolean;
    completionBlockedForMissingField: boolean;
    questionDedupIntercepted: boolean;
}

const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string()
    })).default([]),
    conversationId: z.string().min(1),
    botId: z.string().min(1),
    effectiveDuration: z.union([z.number(), z.string(), z.null()]).optional(),
    introMessage: z.string().optional().nullable(),
    clientMessageId: z.string().min(8).max(128).optional(),
    structuredSubmission: StructuredInterviewSubmissionSchema.optional()
});

type ClientMessage = z.infer<typeof ChatRequestSchema>['messages'][number];

// ============================================================================
// MAIN API HANDLER
// ============================================================================
export async function POST(req: Request) {
    const startTime = Date.now();
    let flushInterviewTokenUsage: (operationSuffix: string) => Promise<void> = async () => {};
    try {
        const simulationMode = isLocalSimulationRequest(req);
        const abVariantHeader = String(req.headers.get('x-interview-ab') || '').trim().toLowerCase();
        const abVariant: InterviewAbVariant = abVariantHeader === 'control' ? 'control' : 'treatment';
        const softQualityGuardsEnabled = abVariant === 'control' ? true : ENABLE_SOFT_QUALITY_GUARDS;
        const nonHardSafetyRegenerationsEnabled = abVariant === 'control' ? true : ENABLE_NON_HARD_SAFETY_REGENERATIONS;
        const body = await req.json();
        const parsedBody = ChatRequestSchema.safeParse(body);
        if (!parsedBody.success) {
            return Response.json(
                {
                    error: 'Invalid chat payload',
                    details: parsedBody.error.issues,
                    serverResponseLatencyMs: Date.now() - startTime
                },
                { status: 400 }
            );
        }

        const {
            messages: incomingMessages,
            conversationId,
            botId,
            effectiveDuration,
            introMessage,
            clientMessageId,
            structuredSubmission
        } = parsedBody.data;
        const requestTag = `[CHAT_API conversation=${conversationId}]`;
        const requestLog = (...args: any[]) => console.log(requestTag, ...args);
        const requestError = (...args: any[]) => console.error(requestTag, ...args);
        const llmTimerLabel = `${requestTag} LLM ${clientMessageId || startTime}`;
        const requestStructuredSubmission = structuredSubmission ?? null;
        const normalizeExtensionReturnPhase = (phase: unknown): InterviewState['extensionReturnPhase'] => {
            if (phase === 'SCAN') return 'EXPLORE';
            if (phase === 'DEEP') return 'DEEPEN';
            if (phase === 'EXPLORE' || phase === 'DEEPEN') return phase;
            return null;
        };

        console.log(`\n🚀 ${requestTag} Processing message`);
        if (simulationMode) {
            requestLog('🧪 Local simulation mode enabled (credits and usage side effects disabled).');
        }
        requestLog(`🧪 Variant=${abVariant} softGuards=${softQualityGuardsEnabled} nonHardRegens=${nonHardSafetyRegenerationsEnabled}`);

        // ====================================================================
        // 1. LOAD DATA (with parallel operations for speed)
        // ====================================================================
        const loadStart = Date.now();
        const conversation = await ChatService.loadConversation(conversationId, botId);
        requestLog(`⏱️ Data load: ${Date.now() - loadStart}ms`);
        const bot = conversation.bot;
        if (bot.status !== 'PUBLISHED') {
            return Response.json({
                text: "Mi dispiace, questa intervista non è al momento disponibile.",
                isCompleted: false,
                serverResponseLatencyMs: Date.now() - startTime
            }, { status: 200 });
        }
        const language = bot.language || 'en';
        const interviewerQuality: 'standard' | 'avanzato' =
            ((bot as any).interviewerQuality === 'avanzato') ? 'avanzato' : 'standard';
        const tierConfig = getTierConfig(interviewerQuality);
        const interviewObjective = String((bot as any).researchGoal || '').trim();
        const candidateDataFields = (bot as any).candidateDataFields ?? [];
        // Legacy fix: bots created before the collectCandidateData flag was introduced
        // may have candidateDataFields populated but collectCandidateData = false.
        // Mirror the same auto-enable logic used in chatbot/message/route.ts.
        const shouldCollectData = Boolean((bot as any).collectCandidateData) || (Array.isArray(candidateDataFields) && candidateDataFields.length > 0);
        requestLog('[DEBUG chat/route] shouldCollectData:', shouldCollectData, typeof shouldCollectData, 'collectCandidateData:', (bot as any).collectCandidateData, 'candidateDataFields:', candidateDataFields);
        const lastIncomingMessage = incomingMessages[incomingMessages.length - 1];
        const interviewProject = (bot as any).project || {};
        const interviewOrganizationId: string | null =
            interviewProject?.organization?.id ||
            interviewProject?.organizationId ||
            null;
        const interviewProjectId: string | undefined = interviewProject?.id || undefined;

        const llmUsageTotals = {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            calls: 0
        };
        const llmUsageByModel = new Map<string, {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            calls: number;
        }>();

        const normalizeLlmUsage = (usage?: LLMUsagePayload | null) => {
            const inputTokens = Number(usage?.inputTokens || 0);
            const outputTokens = Number(usage?.outputTokens || 0);
            const fallbackTotal = Math.max(0, inputTokens) + Math.max(0, outputTokens);
            const totalTokens = Number(usage?.totalTokens || fallbackTotal);
            return {
                inputTokens: Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : 0,
                outputTokens: Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens)) : 0,
                totalTokens: Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : 0
            };
        };

        const resolveModelIdForUsage = (modelLike: unknown): string => {
            if (!modelLike) return 'unknown';
            if (typeof modelLike === 'string') return modelLike;
            if (typeof modelLike === 'object') {
                const asObj = modelLike as Record<string, unknown>;
                const direct = asObj.modelId;
                if (typeof direct === 'string' && direct.trim()) return direct;
                const spec = asObj.specification as Record<string, unknown> | undefined;
                if (spec && typeof spec.modelId === 'string' && spec.modelId.trim()) {
                    return spec.modelId;
                }
            }
            return 'unknown';
        };

        const collectLlmUsage: LLMUsageCollector = ({ source, model, usage }) => {
            const normalized = normalizeLlmUsage(usage);
            if (normalized.totalTokens <= 0) return;

            llmUsageTotals.inputTokens += normalized.inputTokens;
            llmUsageTotals.outputTokens += normalized.outputTokens;
            llmUsageTotals.totalTokens += normalized.totalTokens;
            llmUsageTotals.calls += 1;

            const modelKey = String(model || 'unknown').trim() || 'unknown';
            const modelUsage = llmUsageByModel.get(modelKey) || {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                calls: 0
            };
            modelUsage.inputTokens += normalized.inputTokens;
            modelUsage.outputTokens += normalized.outputTokens;
            modelUsage.totalTokens += normalized.totalTokens;
            modelUsage.calls += 1;
            llmUsageByModel.set(modelKey, modelUsage);

            console.log(
                `📉 [LLM_USAGE] source=${source} model=${modelKey} in=${normalized.inputTokens} out=${normalized.outputTokens} total=${normalized.totalTokens}`
            );
        };

        const trackedGenerateObject = (async (...args: Parameters<typeof generateObject>) => {
            const result = await (generateObject as any)(...args);
            const firstArg = (args[0] || {}) as { model?: unknown };
            collectLlmUsage({
                source: 'chat_route_generate_object',
                model: resolveModelIdForUsage(firstArg.model),
                usage: (result as any)?.usage
            });
            return result;
        }) as typeof generateObject;

        const trackedGenerateText = (async (...args: Parameters<typeof generateText>) => {
            const result = await (generateText as any)(...args);
            const firstArg = (args[0] || {}) as { model?: unknown };
            collectLlmUsage({
                source: 'chat_route_generate_text',
                model: resolveModelIdForUsage(firstArg.model),
                usage: (result as any)?.usage
            });
            return result;
        }) as typeof generateText;

        // trackedStreamText: wraps streamText and collects usage after the stream is consumed
        // Usage is collected via the stream's usage promise (resolves after full stream completes)
        const trackedStreamText = (...args: Parameters<typeof streamText>) => {
            const firstArg = (args[0] || {}) as { model?: unknown };
            const modelId = resolveModelIdForUsage(firstArg.model);
            const streamResult = (streamText as any)(...args);
            // Attach usage collection after stream resolves (non-blocking)
            void (async () => {
                try {
                    const usage = await streamResult.usage;
                    if (usage) {
                        collectLlmUsage({
                            source: 'chat_route_stream_text',
                            model: modelId,
                            usage: {
                                inputTokens: usage.promptTokens ?? 0,
                                outputTokens: usage.completionTokens ?? 0,
                                totalTokens: (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
                            }
                        });
                    }
                } catch {
                    // usage tracking is best-effort for streaming
                }
            })();
            return streamResult as ReturnType<typeof streamText>;
        };

        const getLlmUsageSnapshot = () => ({
            inputTokens: llmUsageTotals.inputTokens,
            outputTokens: llmUsageTotals.outputTokens,
            totalTokens: llmUsageTotals.totalTokens,
            calls: llmUsageTotals.calls,
            byModel: [...llmUsageByModel.entries()].map(([model, usage]) => ({
                model,
                ...usage
            }))
        });

        let llmUsageFlushed = false;
        flushInterviewTokenUsage = async (operationSuffix: string) => {
            if (llmUsageFlushed || simulationMode) return;
            llmUsageFlushed = true;

            if (llmUsageTotals.totalTokens <= 0) return;

            if (!interviewOrganizationId) {
                console.warn('[TokenTracking] Missing interview owner organization. Skipping token charge.', {
                    conversationId,
                    botId: bot.id,
                    totalTokens: llmUsageTotals.totalTokens
                });
                return;
            }

            const dominantModel = [...llmUsageByModel.entries()]
                .sort((a, b) => b[1].totalTokens - a[1].totalTokens)[0]?.[0]
                || String((bot as any).modelName || 'gpt-4o-mini');

            try {
                await TokenTrackingService.logTokenUsage({
                    userId: undefined,
                    organizationId: interviewOrganizationId,
                    projectId: interviewProjectId,
                    inputTokens: llmUsageTotals.inputTokens,
                    outputTokens: llmUsageTotals.outputTokens,
                    category: 'INTERVIEW',
                    model: dominantModel,
                    operation: `interview-response:${operationSuffix}`,
                    resourceType: 'interview',
                    resourceId: bot.id
                });
            } catch (err) {
                console.error('[TokenTracking] Interview usage flush failed:', err);
            }
        };

        // Idempotent replay: if we already answered this client message, return the saved answer.
        if (clientMessageId) {
            const replayedAssistant = await prisma.message.findFirst({
                where: {
                    conversationId,
                    role: 'assistant',
                    metadata: {
                        path: ['replyToClientMessageId'],
                        equals: clientMessageId
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (replayedAssistant) {
                return Response.json({
                    text: replayedAssistant.content,
                    currentTopicId: conversation.currentTopicId,
                    isCompleted: conversation.status === 'COMPLETED',
                    interactionPayload: ((replayedAssistant.metadata as Record<string, unknown> | null)?.interactionPayload as InterviewInteractionPayload | null) ?? null,
                    serverResponseLatencyMs: Date.now() - startTime
                });
            }
        }

        if (!simulationMode) {
            const creditsCheck = await checkCreditsForAction(
                'interview_question',
                undefined,
                (bot as any).project?.id,
                (bot as any).project?.organization?.id
            );
            if (!creditsCheck.allowed) {
                const userFacingError = (language || 'en').toLowerCase().startsWith('it')
                    ? 'Intervista temporaneamente non disponibile per limiti di accesso o crediti. Riprova tra poco oppure contatta il team.'
                    : 'Interview temporarily unavailable due to access or credit limits. Please try again shortly or contact the team.';
                return Response.json(
                    {
                        text: userFacingError,
                        currentTopicId: conversation.currentTopicId,
                        isCompleted: false,
                        degraded: true,
                        serverResponseLatencyMs: Date.now() - startTime,
                        code: (creditsCheck as any).code || 'ACCESS_DENIED',
                        error: creditsCheck.error,
                        creditsNeeded: creditsCheck.creditsNeeded,
                        creditsAvailable: creditsCheck.creditsAvailable
                    },
                    { status: 200 }
                );
            }
        }

        // Run these operations in parallel - they don't depend on each other
        const parallelStart = Date.now();
        const previousEffectiveDuration = Number(conversation.effectiveDuration || 0);
        const parsedEffectiveDuration = Number(effectiveDuration ?? previousEffectiveDuration);
        const safeEffectiveDuration = Number.isFinite(parsedEffectiveDuration)
            ? Math.min(
                Math.max(previousEffectiveDuration, parsedEffectiveDuration),
                previousEffectiveDuration + 600 // Prevent extreme client-side jumps in one turn.
            )
            : previousEffectiveDuration;

        const saveUserMessagePromise = (async () => {
            if (lastIncomingMessage?.role !== 'user') return null;
            const userMessageMetadata = {
                ...(clientMessageId ? { clientMessageId } : {}),
                ...(requestStructuredSubmission ? { structuredSubmission: requestStructuredSubmission } : {})
            };

            if (clientMessageId) {
                const existingUserMessage = await prisma.message.findFirst({
                    where: {
                        conversationId,
                        role: 'user',
                        metadata: {
                            path: ['clientMessageId'],
                            equals: clientMessageId
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                });
                if (existingUserMessage) {
                    return existingUserMessage;
                }

                return prisma.message.create({
                    data: {
                        conversationId,
                        role: 'user',
                        content: lastIncomingMessage.content,
                        metadata: userMessageMetadata
                    }
                });
            }

            return prisma.message.create({
                data: {
                    conversationId,
                    role: 'user',
                    content: lastIncomingMessage.content,
                    metadata: userMessageMetadata
                }
            });
        })();

        const [savedUserMessage, , openAIKey, runtimeModels, prefetchedMemoryData] = await Promise.all([
            saveUserMessagePromise,
            // Update progress
            ChatService.updateProgress(conversationId, safeEffectiveDuration),
            // Get API key
            LLMService.getApiKey(bot, 'openai').then(async key => key || await getConfigValue('openaiApiKey') || ''),
            // Pre-fetch routed models (primary + critical paths)
            LLMService.getInterviewRuntimeModels(bot),
            // Pre-fetch memory data in parallel to avoid sequential latency
            MemoryManager.get(conversationId),
        ]);
        requestLog(`⏱️ Parallel ops: ${Date.now() - parallelStart}ms`);

        const canonicalMessages: ClientMessage[] = conversation.messages.map(m => ({
            role: (m.role as ClientMessage['role']) || 'assistant',
            content: m.content
        }));

        if (savedUserMessage && !conversation.messages.some(m => m.id === savedUserMessage.id)) {
            canonicalMessages.push({
                role: 'user',
                content: savedUserMessage.content
            });
        }

        const lastMessage = canonicalMessages[canonicalMessages.length - 1];
        const previousAssistantMessage = [...canonicalMessages]
            .reverse()
            .find(message => message.role === 'assistant')?.content || null;

        const assistantTurnsSoFar = canonicalMessages.reduce(
            (count, message) => (message.role === 'assistant' ? count + 1 : count),
            0
        );
        const reachedSafetyCap =
            assistantTurnsSoFar >= CONFIG.SAFETY_MAX_ASSISTANT_TURNS ||
            canonicalMessages.length >= CONFIG.SAFETY_MAX_TOTAL_MESSAGES;

        if (reachedSafetyCap) {
            const safetyMessage = language === 'it'
                ? 'Per sicurezza concludo qui l’intervista. Grazie per il contributo: le informazioni raccolte sono già molto utili.'
                : 'For safety, I will conclude the interview here. Thank you: the information collected is already very useful.';

            await completeInterview(
                conversationId,
                canonicalMessages,
                openAIKey,
                conversation.candidateProfile || {},
                { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
            );
            await prisma.message.create({
                data: {
                    conversationId,
                    role: 'assistant',
                    content: safetyMessage,
                    metadata: clientMessageId
                        ? { replyToClientMessageId: clientMessageId, safetyStop: true }
                        : { safetyStop: true }
                }
            });

            await flushInterviewTokenUsage('safety_cap_completion');
            return Response.json({
                text: safetyMessage,
                currentTopicId: conversation.currentTopicId,
                isCompleted: true,
                serverResponseLatencyMs: Date.now() - startTime
            });
        }

        // Topics
        const botTopics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
        const numTopics = botTopics.length;
        const interviewPlan = await getOrCreateInterviewPlan(bot, tierConfig.budgets);
        requestLog("📊 [PLAN] Meta:", {
            maxDurationMins: interviewPlan.meta.maxDurationMins,
            totalTimeSec: interviewPlan.meta.totalTimeSec,
            perTopicTimeSec: interviewPlan.meta.perTopicTimeSec,
            secondsPerTurn: interviewPlan.meta.secondsPerTurn,
            topics: interviewPlan.explore.topics.map(t => ({
                topicId: t.topicId,
                label: t.label,
                minTurns: t.minTurns,
                maxTurns: t.maxTurns
            }))
        });

        // ====================================================================
        // 2. LOAD STATE
        // ====================================================================
        const rawMetadata = (conversation as any).metadata || {};
        const state: InterviewState = {
            phase: rawMetadata.phase || 'EXPLORE',
            topicIndex: rawMetadata.topicIndex ?? 0,
            turnInTopic: rawMetadata.turnInTopic ?? 0,
            deepAccepted: rawMetadata.deepAccepted ?? null,
            consentGiven: rawMetadata.consentGiven ?? null,
            lastAskedField: rawMetadata.lastAskedField ?? null,
            dataCollectionAttempts: rawMetadata.dataCollectionAttempts ?? 0,
            fieldAttemptCounts: rawMetadata.fieldAttemptCounts ?? {},
            closureAttempts: rawMetadata.closureAttempts ?? 0,
            interestingTopics: rawMetadata.interestingTopics ?? [],

            // v2: Elastic turn budget tracking
            topicBudgets: rawMetadata.topicBudgets ?? {},
            turnsUsedTotal: rawMetadata.turnsUsedTotal ?? 0,
            turnsBudgetTotal: rawMetadata.turnsBudgetTotal ?? 0,
            uncoveredTopics: rawMetadata.uncoveredTopics ?? [],
            topicEngagementScores: rawMetadata.topicEngagementScores ?? {},
            topicKeyInsights: rawMetadata.topicKeyInsights ?? {},
            lastSignalScore: rawMetadata.lastSignalScore ?? 0,

            // Legacy DEEP fields (being phased out)
            deepTopicOrder: rawMetadata.deepTopicOrder ?? [],
            deepTurnsByTopic: rawMetadata.deepTurnsByTopic ?? {},
            topicSubGoalHistory: rawMetadata.topicSubGoalHistory ?? {},
            lastUserTopicId: rawMetadata.lastUserTopicId ?? null,
            deepLastSubGoalByTopic: rawMetadata.deepLastSubGoalByTopic ?? {},
            forceConsentQuestion: rawMetadata.forceConsentQuestion ?? false,
            clarificationTurnsByTopic: rawMetadata.clarificationTurnsByTopic ?? {},
            extensionReturnPhase: normalizeExtensionReturnPhase(rawMetadata.extensionReturnPhase),
            extensionReturnTopicIndex: rawMetadata.extensionReturnTopicIndex ?? null,
            extensionReturnTurnInTopic: rawMetadata.extensionReturnTurnInTopic ?? null,
            extensionOfferAttempts: rawMetadata.extensionOfferAttempts ?? 0,
            deepTurnBudgetRemaining: rawMetadata.deepTurnBudgetRemaining ?? null,
            runtimeInterviewKnowledge: rawMetadata.runtimeInterviewKnowledge ?? null,
            runtimeInterviewKnowledgeSignature: rawMetadata.runtimeInterviewKnowledgeSignature ?? null,
            cilState: rawMetadata.cilState ?? null,
            activeInteractionId: rawMetadata.activeInteractionId ?? null,
            activeInteractionKind: rawMetadata.activeInteractionKind ?? null,
            activeInteractionFieldId: rawMetadata.activeInteractionFieldId ?? null,
        };
        const structuredSubmissionMatchesActiveInteraction = Boolean(
            requestStructuredSubmission &&
            state.phase === 'DATA_COLLECTION' &&
            state.activeInteractionId &&
            requestStructuredSubmission.interactionId === state.activeInteractionId &&
            requestStructuredSubmission.kind === state.activeInteractionKind &&
            (
                requestStructuredSubmission.kind !== 'field' ||
                requestStructuredSubmission.fieldId === state.activeInteractionFieldId
            )
        );
        if (requestStructuredSubmission && !structuredSubmissionMatchesActiveInteraction) {
            requestLog(
                `⚠️ Ignoring mismatched structured submission kind=${requestStructuredSubmission.kind} field=${requestStructuredSubmission.kind === 'field' ? requestStructuredSubmission.fieldId : 'n/a'}`
            );
        }

        const activeTopics = state.phase === 'DEEPEN' ? getDeepTopics(botTopics, state.deepTopicOrder) : botTopics;
        const currentTopic = activeTopics[state.topicIndex] || botTopics[0];
        const effectiveSec = Number.isFinite(safeEffectiveDuration)
            ? safeEffectiveDuration
            : Number(conversation.effectiveDuration || 0);
        const maxDurationMins = bot.maxDurationMins || 10;

        const runtimeKnowledgeSignature = buildRuntimeInterviewKnowledgeSignature({
            language,
            researchGoal: bot.researchGoal || '',
            targetAudience: bot.targetAudience || '',
            plan: interviewPlan,
            interviewerQuality: interviewerQuality
        });
        const manualInterviewGuide = extractManualInterviewGuideSource(
            (bot.knowledgeSources || []).map((source: any) => ({
                type: source.type,
                title: source.title,
                content: source.content
            }))
        );
        const hasValidRuntimeKnowledge = isRuntimeInterviewKnowledgeValid(
            state.runtimeInterviewKnowledge,
            runtimeKnowledgeSignature
        );
        const hasLLMRuntimeKnowledge =
            hasValidRuntimeKnowledge &&
            state.runtimeInterviewKnowledge?.source === 'llm';
        const shouldPrepareRuntimeKnowledge =
            (state.phase === 'EXPLORE' || state.phase === 'DEEPEN') &&
            !manualInterviewGuide &&
            !hasValidRuntimeKnowledge;
        const fallbackRuntimeInterviewKnowledge = shouldPrepareRuntimeKnowledge
            ? buildFallbackRuntimeInterviewKnowledge({
                signature: runtimeKnowledgeSignature,
                language,
                interviewGoal: bot.researchGoal || '',
                topics: interviewPlan.explore.topics.map((topic) => ({
                    topicId: topic.topicId,
                    topicLabel: topic.label,
                    subGoals: topic.subGoals || []
                }))
            })
            : null;
        const promptRuntimeInterviewKnowledge = hasValidRuntimeKnowledge
            ? state.runtimeInterviewKnowledge || null
            : fallbackRuntimeInterviewKnowledge;

        requestLog(`📊 [STATE] Phase: ${state.phase}, Topic: ${currentTopic.label}, Index: ${state.topicIndex}, Turn: ${state.turnInTopic}`);
        requestLog(`⏱️ [TIME] Effective: ${effectiveSec}s / Max: ${maxDurationMins}m`);
        if (process.env.NODE_ENV === 'development' && lastMessage?.role === 'user') {
            const userPreview = String(lastMessage.content || '').slice(0, 400);
            console.log("💬 [USER] Preview:", userPreview);
        }

        requestLog("📊 [CHAT] State:", {
            phase: state.phase,
            topic: currentTopic.label,
            topicIndex: state.topicIndex,
            turnInTopic: state.turnInTopic,
            effectiveSec,
            maxDurationMins
        });

        // ====================================================================
        // 3. PHASE MACHINE
        // ====================================================================
        let nextState = { ...state };
        let systemPrompt = "";
        let nextTopicId = currentTopic.id;
        let supervisorInsight: SupervisorInsight = createDefaultSupervisorInsight();
        const isAvanzato = interviewerQuality === 'avanzato';
        // Mutable ref so buildDeepOfferInsight (defined below) can read the CIL result
        // available for the current turn without waiting on a fresh CIL pass.
        const cilAnalysisRef: { current: CILAnalysis | null } = {
            current: buildPromptCILAnalysis(state.cilState ?? null)
        };

        const buildDeepOfferInsight = (
            sourceState: InterviewState,
            validationFeedback?: ValidationResponse
        ) => buildContextualDeepOfferInsight({
            state: sourceState,
            botTopics,
            interviewPlan,
            interviewObjective,
            language,
            validationFeedback,
            includeCilThreads: isAvanzato,
            cilAnalysis: cilAnalysisRef.current
        });

        if (lastMessage?.role === 'user') {
            nextState.lastUserTopicId = currentTopic.id;
        }

        const topicalUserTurnEvaluationPromise =
            lastMessage?.role === 'user' && (state.phase === 'EXPLORE' || state.phase === 'DEEPEN')
                ? evaluateTopicalUserTurn({
                    userMessage: lastMessage.content,
                    apiKey: openAIKey,
                    language,
                    phase: state.phase,
                    currentTopicLabel: currentTopic.label,
                    targetTopicLabel: currentTopic.label,
                    interviewObjective,
                    options: { onUsage: collectLlmUsage }
                })
                : null;

        let topicalUserTurnEvaluation: Awaited<ReturnType<typeof evaluateTopicalUserTurn>> | null = null;
        let topicTurnDecision: TopicTurnDecision | null = null;
        let topicTurnSignalResult: ReturnType<typeof computeSignalScore> | null = null;
        let topicTurnRemainingTargetSubGoals = 0;
        let topicTurnRemainingStretchSubGoals = 0;

        if (topicalUserTurnEvaluationPromise && lastMessage?.role === 'user') {
            topicalUserTurnEvaluation = await topicalUserTurnEvaluationPromise;
            topicTurnSignalResult = computeSignalScore(lastMessage.content || '', language);
            topicTurnRemainingTargetSubGoals = getRemainingSubGoals(
                currentTopic,
                state.topicSubGoalHistory,
                interviewPlan,
                'target_only'
            ).length;
            topicTurnRemainingStretchSubGoals = getRemainingSubGoals(
                currentTopic,
                state.topicSubGoalHistory,
                interviewPlan,
                'target_and_stretch'
            ).length;
            topicTurnDecision = buildTopicTurnDecision({
                phase: state.phase as 'EXPLORE' | 'DEEPEN',
                interviewerQuality,
                interpretation: topicalUserTurnEvaluation,
                signalScore: topicTurnSignalResult.score,
                remainingTargetSubGoals: topicTurnRemainingTargetSubGoals,
                remainingStretchSubGoals: topicTurnRemainingStretchSubGoals,
                turnInTopic: state.turnInTopic,
                maxTurnsInTopic: state.phase === 'DEEPEN'
                    ? getDeepPlanTurns(interviewPlan, currentTopic.id)
                    : getScanPlanTurns(interviewPlan, currentTopic.id)
            });
        }

        let forceEarlyClosureFromUser = false;
        // Skip closure detection in DEEP_OFFER phase - it has its own logic to handle REFUSE vs ACCEPT
        if (lastMessage?.role === 'user' && state.phase !== 'DATA_COLLECTION' && state.phase !== 'DEEP_OFFER') {
            if (topicalUserTurnEvaluation?.wantsToConclude && topicalUserTurnEvaluation.closureConfidence !== 'low') {
                forceEarlyClosureFromUser = true;
                console.log(`🛑 [SUPERVISOR] Explicit user intent to conclude detected. reason="${topicalUserTurnEvaluation.closureReason}" confidence=${topicalUserTurnEvaluation.closureConfidence}`);

                // Reset extension state to avoid offer loops and move straight to closure path.
                nextState.deepAccepted = false;
                nextState.extensionOfferAttempts = 0;
                nextState.extensionReturnPhase = null;
                nextState.extensionReturnTopicIndex = null;
                nextState.extensionReturnTurnInTopic = null;
                nextState.closureAttempts = 0;

                if (shouldCollectData) {
                    nextState.phase = 'DATA_COLLECTION';
                    nextState.consentGiven = false;
                    nextState.forceConsentQuestion = true;
                    supervisorInsight = {
                        status: 'DATA_COLLECTION_CONSENT',
                        stopReason: topicalUserTurnEvaluation.closureReason
                    };
                } else {
                    nextState.phase = 'DATA_COLLECTION';
                    supervisorInsight = {
                        status: 'COMPLETE_WITHOUT_DATA',
                        stopReason: topicalUserTurnEvaluation.closureReason
                    };
                }
            }
        }

        // --------------------------------------------------------------------
        // PHASE: MACHINE
        // --------------------------------------------------------------------
        if (!forceEarlyClosureFromUser && supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA' && supervisorInsight.status !== 'DATA_COLLECTION_CONSENT') {

            if (state.phase === 'EXPLORE') {
                // v2: Signal-driven elastic exploration
                const exploreResult = handleExplorePhase({
                    state,
                    currentTopic,
                    botTopics,
                    lastUserMessage: lastMessage?.role === 'user' ? (lastMessage.content || '') : '',
                    language,
                    interviewPlan,
                    maxDurationMins,
                    effectiveSec,
                    bonusTurnCap: tierConfig.budgets.bonusTurnCap,
                    advanceAfterUsableFirstAnswer: false,
                    topicSubGoalHistory: state.topicSubGoalHistory,
                    interviewerQuality,
                    turnDecision: topicTurnDecision
                });

                // Merge explore result into nextState
                Object.assign(nextState, exploreResult.nextState);
                supervisorInsight = exploreResult.supervisorInsight;
                if (exploreResult.nextTopicId) {
                    nextTopicId = exploreResult.nextTopicId;
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DEEP_OFFER
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEP_OFFER') {
                requestLog(`🎁 [DEEP_OFFER] State: deepAccepted=${state.deepAccepted} returnPhase=${state.extensionReturnPhase || 'DEEPEN'} attempts=${state.extensionOfferAttempts || 0}`);
                const deepOfferIntentCache = new Map<string, Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'>>();
                const evaluateDeepOfferIntent = (userMessage: string): Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'> => {
                    const cacheKey = String(userMessage || '');
                    const cached = deepOfferIntentCache.get(cacheKey);
                    if (cached) return cached;
                    const intentPromise = checkUserIntent(userMessage, openAIKey, language, 'deep_offer', { onUsage: collectLlmUsage });
                    deepOfferIntentCache.set(cacheKey, intentPromise);
                    return intentPromise;
                };
                const deepOfferResult = await runDeepOfferPhase({
                    state: state as InterviewStateLike,
                    nextState: nextState as InterviewStateLike,
                    botTopics,
                    canonicalMessages,
                    lastUserMessage: lastMessage?.role === 'user' ? (lastMessage.content || '') : '',
                    shouldCollectData,
                    maxDurationMins,
                    effectiveSec,
                    deepExtraTurnCap: tierConfig.budgets.deepExtraTurnCap,
                    deps: {
                        checkUserIntent: async (userMessage: string, context: 'deep_offer') =>
                            context === 'deep_offer'
                                ? evaluateDeepOfferIntent(userMessage)
                                : checkUserIntent(userMessage, openAIKey, language, context, { onUsage: collectLlmUsage }),
                        isExtensionOfferQuestion: async (message: string) =>
                            isAssistantExtensionOffer({
                                assistantMessage: message,
                                apiKey: openAIKey,
                                language,
                                options: { onUsage: collectLlmUsage }
                            }),
                        buildDeepOfferInsight: (sourceState: InterviewStateLike, validationFeedback?: ValidationResponse) =>
                            buildDeepOfferInsight(sourceState as InterviewState, validationFeedback),
                        buildDeepPlan: (remainingSec: number) =>
                            buildDeepPlan(
                                botTopics,
                                interviewPlan,
                                state.topicSubGoalHistory,
                                state.interestingTopics,
                                remainingSec,
                                interviewObjective,
                                language
                            ),
                        getDeepTopics: (deepOrder?: string[]) => getDeepTopics(botTopics, deepOrder),
                        getRemainingSubGoals: (topic: any, history?: Record<string, string[]>) => getRemainingSubGoals(topic, history, interviewPlan, 'target_and_stretch'),
                        selectDeepFocusPoint: ({ topic, availableSubGoals, engagingSnippet, lastUserMessage }) =>
                            selectDeepFocusPoint({
                                topic,
                                availableSubGoals,
                                engagingSnippet,
                                interviewObjective,
                                lastUserMessage,
                                language
                            })
                    }
                });
                Object.assign(nextState, deepOfferResult.nextState);
                supervisorInsight = deepOfferResult.supervisorInsight;
                if (deepOfferResult.nextTopicId) {
                    nextTopicId = deepOfferResult.nextTopicId;
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DEEPEN
            // --------------------------------------------------------------------
            else if (state.phase === 'DEEPEN') {
                // v2: Residual exploration of uncovered topics
                const deepenResult = handleDeepenPhase({
                    state,
                    currentTopic,
                    botTopics,
                    language,
                    maxDurationMins,
                    effectiveSec,
                    deepenMaxTurnsPerTopic: tierConfig.budgets.deepenMaxTurnsPerTopic,
                    deepExtraTurnCap: tierConfig.budgets.deepExtraTurnCap,
                    interviewPlan,
                    topicSubGoalHistory: state.topicSubGoalHistory,
                    interviewerQuality,
                    turnDecision: topicTurnDecision
                });

                // Merge deepen result into nextState
                Object.assign(nextState, deepenResult.nextState);
                supervisorInsight = deepenResult.supervisorInsight;
                if (deepenResult.nextTopicId) {
                    nextTopicId = deepenResult.nextTopicId;
                }

                // crossTopicSynthesis: inject notes from other already-covered topics into DEEPENING insight
                // Only for tiers that enable this feature (avanzato); standard bots skip this block.
                if (tierConfig.naturalness.crossTopicSynthesis && supervisorInsight.status === 'DEEPENING') {
                    const keyInsights = state.topicKeyInsights || {};
                    const currentId = currentTopic.id;
                    const otherInsights = Object.entries(keyInsights)
                        .filter(([id]) => id !== currentId)
                        .map(([id, snippet]) => {
                            const t = botTopics.find(bt => bt.id === id);
                            return t ? `${t.label}: "${snippet}"` : null;
                        })
                        .filter((v): v is string => Boolean(v))
                        .slice(0, 2);
                    if (otherInsights.length > 0) {
                        supervisorInsight = { ...supervisorInsight, crossTopicNotes: otherInsights.join(' | ') };
                    }
                }
            }

            // --------------------------------------------------------------------
            // PHASE: DATA_COLLECTION
            // --------------------------------------------------------------------
            else if (state.phase === 'DATA_COLLECTION') {
                console.log(`📋 [DATA_COLLECTION] State: consentGiven=${state.consentGiven}, lastAskedField=${state.lastAskedField}, attempts=${state.dataCollectionAttempts}`);

                // Anti-loop protection
                if (state.dataCollectionAttempts >= CONFIG.MAX_DATA_COLLECTION_ATTEMPTS) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                }

                if (state.dataCollectionRefused) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                    nextState.dataCollectionRefused = true;
                }

                const shouldContinueDataCollection = supervisorInsight.status !== 'COMPLETE_WITHOUT_DATA';
                if (shouldContinueDataCollection) {
                    const candidateFields = (bot.candidateDataFields as any[]) || [];
                    const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
                    let currentProfile = (conversation.candidateProfile as any) || {};
                    let justAcceptedConsentThisTurn = false;
                    const dataCollectionInterpretationCache = new Map<string, Promise<DataCollectionTurnInterpretation>>();
                    const evaluateCurrentDataCollectionTurn = (params: {
                        consentRequested: boolean;
                        expectedFieldName?: string | null;
                    }): Promise<DataCollectionTurnInterpretation> => {
                        const userText = lastMessage?.role === 'user' ? lastMessage.content : '';
                        const cacheKey = JSON.stringify({
                            userText,
                            consentRequested: params.consentRequested,
                            expectedFieldName: params.expectedFieldName || null
                        });
                        const cached = dataCollectionInterpretationCache.get(cacheKey);
                        if (cached) return cached;
                        const evaluationPromise = evaluateDataCollectionUserTurn({
                            userMessage: userText,
                            apiKey: openAIKey,
                            language,
                            consentRequested: params.consentRequested,
                            expectedFieldName: params.expectedFieldName || null,
                            options: { onUsage: collectLlmUsage }
                        });
                        dataCollectionInterpretationCache.set(cacheKey, evaluationPromise);
                        return evaluationPromise;
                    };
                    console.log(`📋 [DATA_COLLECTION] Fields to collect: ${candidateFieldIds.join(', ')}`);
                    console.log(`📋 [DATA_COLLECTION] Current profile keys: ${Object.keys(currentProfile).join(', ') || 'none'}`);

                    // STEP 1: Handle consent flow
                    if (state.consentGiven === null) {
                        // First time in DATA_COLLECTION - ask for consent
                        console.log(`📋 [DATA_COLLECTION] Asking for consent (first time)`);
                        supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                        nextState.consentGiven = false; // Mark that we're waiting for response
                        nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                    } else if (state.consentGiven === false) {
                        // We asked for consent, now check user's response
                        console.log(`📋 [DATA_COLLECTION] Checking consent response`);
                        const interpretation = structuredSubmissionMatchesActiveInteraction && requestStructuredSubmission?.kind === 'consent'
                            ? {
                                consentIntent: requestStructuredSubmission.action === 'accept' ? 'ACCEPT' : 'REFUSE'
                            }
                            : await evaluateCurrentDataCollectionTurn({
                                consentRequested: true
                            });
                        const intent = interpretation.consentIntent;
                        console.log(`📋 [DATA_COLLECTION] Intent detected: ${intent}`);

                        if (intent === 'ACCEPT') {
                            nextState.consentGiven = true;
                            justAcceptedConsentThisTurn = true;
                            console.log(`📋 [DATA_COLLECTION] User accepted, will ask first field`);
                            // Don't set supervisorInsight here - let it fall through to ask first field
                        } else if (intent === 'REFUSE') {
                            console.log(`📋 [DATA_COLLECTION] User refused consent.`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                            );
                            // Set status for AI to say goodbye
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
                            nextState.consentGiven = false;
                            nextState.lastAskedField = null;
                            nextState.dataCollectionRefused = true;
                        } else {
                            // NEUTRAL - re-ask consent
                            console.log(`📋 [DATA_COLLECTION] Neutral response, re-asking consent`);
                            supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
                            nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                        }
                    }

                    // STEP 2: If consent given (now or before), handle field collection
                    if (nextState.consentGiven === true || state.consentGiven === true) {
                        console.log(`📋 [DATA_COLLECTION] Consent given, processing fields`);
                        if (justAcceptedConsentThisTurn) {
                            const nextFieldAfterConsent = getNextMissingCandidateField(
                                candidateFieldIds,
                                currentProfile,
                                state.fieldAttemptCounts,
                                3
                            );
                            if (nextFieldAfterConsent) {
                                nextState.lastAskedField = nextFieldAfterConsent;
                                nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                                nextState.consentGiven = true;
                                nextState.fieldAttemptCounts = {
                                    ...state.fieldAttemptCounts,
                                    [nextFieldAfterConsent]: (state.fieldAttemptCounts[nextFieldAfterConsent] || 0) + 1
                                };
                                supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextFieldAfterConsent };
                                console.log(`📋 [DATA_COLLECTION] Consent accepted this turn. Skipping extraction and asking first field "${nextFieldAfterConsent}".`);
                            } else {
                                supervisorInsight = { status: 'FINAL_GOODBYE' };
                                nextState.lastAskedField = null;
                                console.log(`📋 [DATA_COLLECTION] Consent accepted but no missing fields. Closing data collection.`);
                            }
                            // Critical: do not process the consent message as field content.
                        } else {
                            let haltCollection = false;
                            const missingFieldIds = candidateFieldIds.filter((fieldName: string) =>
                                !currentProfile[fieldName] && currentProfile[fieldName] !== '__SKIPPED__'
                            );
                            const lastAsked = state.lastAskedField;
                            const prioritizedField = (lastAsked && missingFieldIds.includes(lastAsked))
                                ? lastAsked
                                : (missingFieldIds[0] || null);
                            const structuredFieldSubmission = (
                                structuredSubmissionMatchesActiveInteraction &&
                                requestStructuredSubmission?.kind === 'field' &&
                                prioritizedField &&
                                requestStructuredSubmission.fieldId === prioritizedField
                            )
                                ? requestStructuredSubmission
                                : null;
                            const dataCollectionInterpretation = lastMessage?.role === 'user' && !structuredFieldSubmission
                                ? await evaluateCurrentDataCollectionTurn({
                                    consentRequested: false,
                                    expectedFieldName: prioritizedField
                                })
                                : {
                                    consentIntent: 'NEUTRAL',
                                    wantsToConclude: false,
                                    closureConfidence: 'low',
                                    isFrustrated: false,
                                    wantsToSkipField: false,
                                    extractedExpectedFieldValue: null,
                                    extractedExpectedFieldConfidence: 'none'
                                } satisfies DataCollectionTurnInterpretation;

                            const userWantsToStopMidCollection =
                                dataCollectionInterpretation.wantsToConclude &&
                                dataCollectionInterpretation.closureConfidence !== 'low';

                            if (userWantsToStopMidCollection) {
                                console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection (semantic). confidence=${dataCollectionInterpretation.closureConfidence}`);
                                await completeInterview(
                                    conversationId,
                                    canonicalMessages,
                                    openAIKey,
                                    currentProfile,
                                    { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                                );
                                supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                                nextState.dataCollectionRefused = true;
                                haltCollection = true;
                            }

                            // If user is frustrated about repeated questions, try to recover obvious data and complete.
                            if (!haltCollection && dataCollectionInterpretation.isFrustrated) {
                                console.log(`⚠️ [DATA_COLLECTION] User frustrated - attempting to extract from history and complete`);

                                const configuredNameField = candidateFieldIds.find((fieldName: string) =>
                                    fieldName === 'name' || fieldName === 'fullName'
                                );
                                const nameFieldKey = configuredNameField || 'fullName';

                                if (!currentProfile[nameFieldKey]) {
                                    for (let i = canonicalMessages.length - 1; i >= 0; i--) {
                                        const msg = canonicalMessages[i];
                                        if (msg.role === 'user') {
                                            const content = msg.content.trim();
                                            const words = content.split(/\s+/);
                                            if (words.length <= 3 && content.length < 30 && !/[@\d]/.test(content)) {
                                                const cleanedName = content.replace(/[.!?,;:]/g, '').trim();
                                                if (cleanedName.length > 1) {
                                                    currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                                    console.log(`✅ [DATA_COLLECTION] Recovered name from history for "${nameFieldKey}"`);
                                                    await prisma.conversation.update({
                                                        where: { id: conversationId },
                                                        data: { candidateProfile: currentProfile }
                                                    });
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }

                                await completeInterview(
                                    conversationId,
                                    canonicalMessages,
                                    openAIKey,
                                    currentProfile,
                                    { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                                );
                                supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                                haltCollection = true;
                            }

                            if (!haltCollection) {
                                const userWantsToSkip = Boolean(
                                    structuredFieldSubmission
                                        ? structuredFieldSubmission.action === 'skip'
                                        : (dataCollectionInterpretation.wantsToSkipField && prioritizedField)
                                );

                                console.log(`📋 [DATA_COLLECTION] Missing fields: ${missingFieldIds.join(', ') || 'none'}`);
                                console.log(`📋 [DATA_COLLECTION] Prioritized field: ${prioritizedField || 'none'}`);

                                // Targeted extraction strategy:
                                // 1) prioritize the field we just asked,
                                // 2) opportunistically capture deterministic structured fields (email/phone/url),
                                // 3) use one semantic extraction for the prioritized field only when needed.
                                if (prioritizedField && structuredFieldSubmission && structuredFieldSubmission.action === 'submit' && !justAcceptedConsentThisTurn) {
                                    const rawStructuredValue = String(
                                        structuredFieldSubmission.value ??
                                        structuredFieldSubmission.optionId ??
                                        ''
                                    ).trim();
                                    let extractedValue: string | null = rawStructuredValue || null;
                                    let extractedConfidence: 'high' | 'low' | 'none' = extractedValue ? 'high' : 'none';

                                    if (['email', 'phone', 'linkedin', 'portfolio'].includes(prioritizedField)) {
                                        const deterministicValue = extractDeterministicFieldValue(prioritizedField, rawStructuredValue);
                                        if (deterministicValue) {
                                            extractedValue = deterministicValue;
                                            extractedConfidence = 'high';
                                        } else {
                                            extractedValue = null;
                                            extractedConfidence = rawStructuredValue ? 'low' : 'none';
                                        }
                                    }

                                    const attemptCount = (state.fieldAttemptCounts?.[prioritizedField] || 0) + 1;
                                    const validationResult = validateExtractedField(
                                        prioritizedField,
                                        extractedValue,
                                        extractedConfidence,
                                        attemptCount,
                                        language as 'it' | 'en'
                                    );

                                    if (validationResult.isValid) {
                                        currentProfile = { ...currentProfile, [prioritizedField]: extractedValue };
                                        await prisma.conversation.update({
                                            where: { id: conversationId },
                                            data: { candidateProfile: currentProfile }
                                        });
                                        console.log(`✅ [DATA_COLLECTION] Structured submission saved for "${prioritizedField}"`);
                                    } else if (!supervisorInsight.validationFeedback) {
                                        supervisorInsight.validationFeedback = validationResult;
                                        supervisorInsight.feedbackMessage = validationResult.feedback;
                                        console.log(`⚠️ [DATA_COLLECTION] Structured submission invalid for "${prioritizedField}": ${validationResult.reason}`);
                                    }
                                } else if (lastMessage?.role === 'user' && !userWantsToSkip && !justAcceptedConsentThisTurn) {
                                    let profileChanged = false;

                                    const opportunisticFields = missingFieldIds.filter((fieldName: string) =>
                                        ['email', 'phone', 'linkedin', 'portfolio'].includes(fieldName) && fieldName !== prioritizedField
                                    );
                                    for (const fieldName of opportunisticFields) {
                                        const deterministicValue = extractDeterministicFieldValue(fieldName, lastMessage.content);
                                        if (deterministicValue) {
                                            currentProfile = { ...currentProfile, [fieldName]: deterministicValue };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Opportunistic deterministic capture for "${fieldName}"`);
                                        }
                                    }

                                    if (prioritizedField) {
                                        let extractedValue: string | null = null;
                                        let extractedConfidence: 'high' | 'low' | 'none' = 'none';

                                        if (!currentProfile[prioritizedField]) {
                                            const deterministicValue = extractDeterministicFieldValue(prioritizedField, lastMessage.content);
                                            if (deterministicValue) {
                                                extractedValue = deterministicValue;
                                                extractedConfidence = 'high';
                                                console.log(`✅ [DATA_COLLECTION] Deterministic extraction for "${prioritizedField}"`);
                                            }
                                        }

                                        if (!extractedValue && !currentProfile[prioritizedField]) {
                                            extractedValue = dataCollectionInterpretation.extractedExpectedFieldValue;
                                            extractedConfidence = dataCollectionInterpretation.extractedExpectedFieldConfidence;
                                        }

                                        if (extractedValue && !currentProfile[prioritizedField]) {
                                            const attemptCount = (state.fieldAttemptCounts?.[prioritizedField] || 0) + 1;
                                            const validationResult = validateExtractedField(
                                                prioritizedField,
                                                extractedValue,
                                                extractedConfidence,
                                                attemptCount,
                                                language as 'it' | 'en'
                                            );

                                            console.log(`🔍 [DATA_COLLECTION] Extraction result for "${prioritizedField}": confidence="${extractedConfidence}" feedback="${validationResult.feedback}"`);

                                            if (validationResult.isValid) {
                                                currentProfile = { ...currentProfile, [prioritizedField]: extractedValue };
                                                profileChanged = true;
                                                console.log(`✅ [DATA_COLLECTION] Semantic extraction for "${prioritizedField}"`);
                                            } else {
                                                console.log(`⚠️ [DATA_COLLECTION] Could not extract "${prioritizedField}": ${validationResult.reason}`);
                                                if (!supervisorInsight.validationFeedback) {
                                                    supervisorInsight.validationFeedback = validationResult;
                                                    supervisorInsight.feedbackMessage = validationResult.feedback;
                                                }
                                            }
                                        } else if (!currentProfile[prioritizedField]) {
                                            const attemptCount = (state.fieldAttemptCounts?.[prioritizedField] || 0) + 1;
                                            const validationResult = validateExtractedField(
                                                prioritizedField,
                                                null,
                                                'none',
                                                attemptCount,
                                                language as 'it' | 'en'
                                            );
                                            if (!supervisorInsight.validationFeedback) {
                                                supervisorInsight.validationFeedback = validationResult;
                                                supervisorInsight.feedbackMessage = validationResult.feedback;
                                            }
                                        }
                                    }

                                    if (profileChanged) {
                                        await prisma.conversation.update({
                                            where: { id: conversationId },
                                            data: { candidateProfile: currentProfile }
                                        });
                                        console.log(`✅ [DATA_COLLECTION] Saved profile`);
                                    }
                                } else if (justAcceptedConsentThisTurn) {
                                    console.log(`📋 [DATA_COLLECTION] Consent just accepted: skip extraction this turn and ask first missing field.`);
                                } else if (userWantsToSkip && prioritizedField) {
                                    console.log(`📋 [DATA_COLLECTION] User wants to skip "${prioritizedField}"`);
                                    currentProfile = { ...currentProfile, [prioritizedField]: '__SKIPPED__' };
                                    await prisma.conversation.update({
                                        where: { id: conversationId },
                                        data: { candidateProfile: currentProfile }
                                    });
                                }

                                const MAX_FIELD_ATTEMPTS = 3;
                                const nextField = getNextMissingCandidateField(
                                    candidateFieldIds,
                                    currentProfile,
                                    state.fieldAttemptCounts,
                                    MAX_FIELD_ATTEMPTS
                                );
                                console.log(`📋 [DATA_COLLECTION] Next field to ask: ${nextField || 'NONE - all collected/skipped'}`);

                                if (!nextField) {
                                    console.log(`✅ [DATA_COLLECTION] All fields collected/skipped, letting AI say final goodbye`);
                                    supervisorInsight = { status: 'FINAL_GOODBYE' };
                                    nextState.lastAskedField = null;
                                } else {
                                    nextState.lastAskedField = nextField;
                                    nextState.dataCollectionAttempts = state.dataCollectionAttempts + 1;
                                    nextState.consentGiven = true;
                                    nextState.fieldAttemptCounts = {
                                        ...state.fieldAttemptCounts,
                                        [nextField]: (state.fieldAttemptCounts[nextField] || 0) + 1
                                    };
                                    supervisorInsight = { status: 'DATA_COLLECTION', nextSubGoal: nextField };
                                }
                            }
                        }
                    }
                } else {
                    nextState.dataCollectionAttempts = CONFIG.MAX_DATA_COLLECTION_ATTEMPTS;
                }
            }
        }

        // Log supervisor insight and next state transition for visibility
        requestLog(`📊 [SUPERVISOR] Insight: ${supervisorInsight?.status || 'N/A'}, NextSubGoal: ${supervisorInsight?.nextSubGoal || 'N/A'}`);

        // Guard: DEEP_OFFER must be presented at least once before DATA_COLLECTION.
        // state.deepAccepted === null means the offer has never been made this conversation.
        // We skip the guard when state.phase is already DEEP_OFFER (i.e., the offer was just refused
        // and we are legitimately exiting to DATA_COLLECTION).
        if (nextState.phase === 'DATA_COLLECTION' && state.deepAccepted === null && state.phase !== 'DEEP_OFFER') {
            requestLog(`🛡️ [FLOW] Redirecting DATA_COLLECTION → DEEP_OFFER (offer not yet seen)`);
            nextState.phase = 'DEEP_OFFER';
            nextState.deepAccepted = null;
            supervisorInsight = createDefaultSupervisorInsight();
        }

        requestLog(`🧭 [FLOW] Phase Transition: ${state.phase} -> ${nextState.phase}`);
        if (state.topicIndex !== nextState.topicIndex) {
            requestLog(`🔄 [TOPIC] Pivot: Topic Index ${state.topicIndex} -> ${nextState.topicIndex}`);
        }

        // ====================================================================
        // 4. BUILD PROMPT
        // ====================================================================
        const methodology = LLMService.getMethodology();
        const modelRegistry: InterviewRuntimeModels = runtimeModels;
        const model = modelRegistry.primary;
        const criticalModel = modelRegistry.critical;
        const qualityModel = modelRegistry.quality;
        const dataCollectionModel = modelRegistry.dataCollection;
        requestLog("🧠 [MODEL_ROUTING]", modelRegistry.names);
        const nextActiveTopics = nextState.phase === 'DEEPEN'
            ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
            : botTopics;
        const targetTopic = nextActiveTopics[nextState.topicIndex] || currentTopic;
        const userTurnSignal: UserTurnSignal =
            topicalUserTurnEvaluation && (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN')
                ? topicalUserTurnEvaluation.signal
                : 'none';
        const shouldRefreshRuntimeKnowledge =
            (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') &&
            !manualInterviewGuide &&
            !hasLLMRuntimeKnowledge &&
            canonicalMessages.length >= 2 &&
            (nextState.turnInTopic <= 1 || userTurnSignal !== 'none');
        const runtimeInterviewKnowledgeRefreshPromise: Promise<RuntimeInterviewKnowledge | null> | null = shouldRefreshRuntimeKnowledge
            ? generateRuntimeInterviewKnowledge({
                model: runtimeModels.quality,
                signature: runtimeKnowledgeSignature,
                language,
                interviewGoal: bot.researchGoal || '',
                targetAudience: bot.targetAudience || '',
                topics: interviewPlan.explore.topics.map((topic) => ({
                    topicId: topic.topicId,
                    topicLabel: topic.label,
                    subGoals: topic.subGoals || []
                })),
                timeoutMs: tierConfig.knowledge.runtimeKnowledgeTimeoutMs,
                interviewerQuality: interviewerQuality,
                onUsage: collectLlmUsage
            })
            : null;
        const runtimeInterviewKnowledge = promptRuntimeInterviewKnowledge;
        if (runtimeInterviewKnowledge) {
            nextState.runtimeInterviewKnowledge = runtimeInterviewKnowledge;
            nextState.runtimeInterviewKnowledgeSignature = runtimeKnowledgeSignature;
        } else if (!manualInterviewGuide && !hasValidRuntimeKnowledge) {
            nextState.runtimeInterviewKnowledge = null;
            nextState.runtimeInterviewKnowledgeSignature = null;
        }

        // --- CIL PRE-PASS (avanzato only, but not every turn) ---
        const AVANZATO_CIL_RECENT_TURNS = 5;
        const shouldRunFreshCIL =
            isAvanzato &&
            (nextState.phase === 'DEEPEN' || userTurnSignal !== 'none') &&
            (userTurnSignal !== 'none' || nextState.turnInTopic % 2 === 1);

        const cilAnalysisPromise: Promise<CILAnalysis | null> | null = shouldRunFreshCIL
            ? (async () => {
                const topicKnowledge = runtimeInterviewKnowledge?.topics.find(
                    t => t.topicId === currentTopic.id
                ) ?? null;
                const recentTurns = canonicalMessages
                    .slice(-AVANZATO_CIL_RECENT_TURNS)
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
                return generateCILAnalysis({
                    recentTurns,
                    currentTopicId: currentTopic.id,
                    cilState: state.cilState ?? EMPTY_CIL_STATE,
                    topicKnowledge,
                    model: modelRegistry.primary,
                    language: bot.language || 'it'
                });
            })()
            : null;

        const previousAssistantQuestion = extractLastAssistantQuestion(previousAssistantMessage);
        const recentBridgeStems = collectRecentBridgeStems(canonicalMessages, 14);
        const plannerTopic = targetTopic || currentTopic;
        const plannerTopicId = plannerTopic?.id || currentTopic.id;
        const plannerMaxTurns = nextState.phase === 'DEEPEN'
            ? getDeepPlanTurns(interviewPlan, plannerTopicId)
            : getScanPlanTurns(interviewPlan, plannerTopicId);
        const plannerUsedSubGoals = (nextState.topicSubGoalHistory || {})[plannerTopicId] || [];
        const promptCILAnalysis = cilAnalysisRef.current;

        const microPlannerDecision = buildMicroPlannerDecision({
            language,
            phase: nextState.phase,
            topicId: plannerTopicId,
            topicLabel: plannerTopic?.label || currentTopic.label,
            topicSubGoals: plannerTopic?.subGoals || currentTopic.subGoals || [],
            usedSubGoals: plannerUsedSubGoals,
            turnInTopic: nextState.turnInTopic,
            maxTurnsInTopic: plannerMaxTurns,
            userMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
            userTurnSignal,
            previousAssistantQuestion,
            manualGuide: manualInterviewGuide,
            runtimeKnowledge: runtimeInterviewKnowledge || state.runtimeInterviewKnowledge || null,
            topicKeyInsights: tierConfig.naturalness.crossTopicSynthesis ? (nextState.topicKeyInsights || {}) : undefined,
            naturalness: {
                crossTopicSynthesis: tierConfig.naturalness.crossTopicSynthesis,
                hesitationDetection: tierConfig.naturalness.hesitationDetection,
                contextDrivenReordering: tierConfig.naturalness.contextDrivenReordering,
            },
        }, {
            probeExampleThreshold: tierConfig.budgets.probeExampleThreshold,
            probeImpactExploreThreshold: tierConfig.budgets.probeImpactExploreThreshold,
            probeImpactDeepenThreshold: tierConfig.budgets.probeImpactDeepenThreshold,
        });


        systemPrompt = await PromptBuilder.build(
            bot,
            conversation,
            currentTopic,
            effectiveSec,
            supervisorInsight,
            interviewPlan,
            manualInterviewGuide || undefined,
            interviewerQuality,
            prefetchedMemoryData  // NEW: pre-fetched to run in parallel with other init ops
        );
        const manualKnowledgePrompt = buildManualKnowledgePromptBlock({
            manualGuide: manualInterviewGuide,
            phase: nextState.phase,
            language,
            topicLabel: targetTopic?.label || currentTopic.label,
            topicSubGoals: targetTopic?.subGoals || currentTopic.subGoals || []
        });
        const generatedKnowledgePrompt = manualKnowledgePrompt
            ? ''
            : buildRuntimeKnowledgePromptBlock({
                knowledge: runtimeInterviewKnowledge || state.runtimeInterviewKnowledge || null,
                phase: nextState.phase,
                targetTopicId: targetTopic?.id || currentTopic.id,
                language
            });
        if (manualKnowledgePrompt || generatedKnowledgePrompt) {
            systemPrompt += `\n\n${manualKnowledgePrompt || generatedKnowledgePrompt}`;
        }

        // Tone adaptation — active from turn 4 onwards (need enough context to detect style)
        if (canonicalMessages.length >= 4) {
            try {
                const toneAnalyzer = new ToneAnalyzer(openAIKey);
                const shouldUseLlmToneAnalysis =
                    tierConfig.tone.useLlm &&
                    canonicalMessages.length >= 8 &&
                    (nextState.phase === 'DEEPEN' || userTurnSignal !== 'none') &&
                    nextState.turnInTopic % 3 === 0;
                const toneProfile = shouldUseLlmToneAnalysis
                    ? await toneAnalyzer.analyzeTone(canonicalMessages, language)
                    : toneAnalyzer.analyzeToHeuristic(canonicalMessages, language);
                const toneBlock = buildToneAdaptationPrompt(toneProfile, language);
                if (toneBlock) {
                    systemPrompt += `\n\n${toneBlock}`;
                }
            } catch (toneErr) {
                // Non-blocking: tone adaptation is best-effort, never fails the main request
                console.error('[TONE] Analysis failed (non-blocking):', toneErr);
            }
        }

        requestLog("📝 [PROMPT_BUILDER] System Prompt length:", systemPrompt.length);
        if (process.env.NODE_ENV === 'development') {
            console.log("📝 [PROMPT_BUILDER] System Prompt snippet:", systemPrompt.substring(0, 1000) + "...");
        }

        // Inject intro message at start
        if (introMessage && canonicalMessages.length <= 1) {
            systemPrompt += `\n\nIMPORTANT: Start your response with exactly:\n"${introMessage}"\nThen follow with your first question.`;
        }

        // Phase-specific injections

        // Final reinforcement based on phase - CLEAR STATUS BANNER
        const shouldShowStatusBanner = (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') &&
            ['EXPLORING', 'DEEPENING', 'TRANSITION'].includes(supervisorInsight?.status);

        if (shouldShowStatusBanner) {
            const bannerTopics = nextState.phase === 'DEEPEN'
                ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
                : botTopics;
            const bannerTopic = bannerTopics[nextState.topicIndex] || currentTopic;
            const currentTopicLabel = bannerTopic?.label || 'current topic';
            const targetTopicId = bannerTopic?.id || currentTopic.id;
            const scanMaxTurns = getScanPlanTurns(interviewPlan, targetTopicId);
            const deepTurns = Math.max(1, (nextState.deepTurnsByTopic || {})[targetTopicId] || getDeepPlanTurns(interviewPlan, targetTopicId));
            const isItalianPrompt = (language || '').toLowerCase().startsWith('it');
            const turnsInfo = nextState.phase === 'EXPLORE'
                ? (isItalianPrompt
                    ? `Turno ${nextState.turnInTopic}/${scanMaxTurns}`
                    : `Turn ${nextState.turnInTopic}/${scanMaxTurns}`)
                : (isItalianPrompt
                    ? `Turno ${nextState.turnInTopic}/${deepTurns}`
                    : `Turn ${nextState.turnInTopic}/${deepTurns}`);
            const statusBanner = isItalianPrompt
                ? `
[SUPERVISOR_RUNTIME]
fase=${nextState.phase}
topic="${currentTopicLabel}" (${nextState.topicIndex + 1}/${numTopics})
progresso=${turnsInfo}
regole_dure:
- Fai esattamente UNA domanda su "${currentTopicLabel}".
- Non chiedere contatti.
- Non chiudere l'intervista.
- Non aggiungere promo/CTA.
`
                : `
[SUPERVISOR_RUNTIME]
phase=${nextState.phase}
topic="${currentTopicLabel}" (${nextState.topicIndex + 1}/${numTopics})
progress=${turnsInfo}
hard_rules:
- Ask exactly ONE question about "${currentTopicLabel}".
- Do NOT ask for contacts.
- Do NOT close or wrap up.
- Do NOT add promo/CTA.
`;
            systemPrompt += statusBanner;
        }

        if (lastMessage?.role === 'user') {
            const runtimeSemanticContext = buildRuntimeSemanticContextPrompt({
                language,
                phase: nextState.phase,
                targetTopicLabel: targetTopic?.label || currentTopic.label,
                supervisorInsight,
                lastUserMessage: lastMessage.content,
                previousAssistantMessage,
                recentBridgeStems
            });
            if (runtimeSemanticContext) {
                systemPrompt += `\n\n${runtimeSemanticContext}`;
            }
        }
        if (
            lastMessage?.role === 'user' &&
            (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') &&
            topicTurnSignalResult
        ) {
            const turnGuidanceBlock = buildTurnGuidanceBlock({
                language,
                phase: nextState.phase,
                signalResult: topicTurnSignalResult,
                lastUserMessage: lastMessage.content,
                recentBridgeStems,
                interviewerQuality,
                currentTopicLabel: currentTopic.label,
                targetTopicLabel: targetTopic?.label || currentTopic.label,
                turnDecision: topicTurnDecision,
                remainingTargetSubGoals: topicTurnRemainingTargetSubGoals,
                remainingStretchSubGoals: topicTurnRemainingStretchSubGoals,
            });
            if (turnGuidanceBlock) {
                systemPrompt += `\n\n${turnGuidanceBlock}`;
            }
        }
        // Block 6.5 — CIL context (avanzato only) — injected BEFORE micro-planner
        if (promptCILAnalysis && isAvanzato) {
            const cilBlock = buildCILContextBlock(
                promptCILAnalysis,
                state.cilState ?? null,
                interviewerQuality,
                {
                    latestUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                    freshness: 'stale'
                }
            );
            if (cilBlock) {
                systemPrompt += `\n\n${cilBlock}`;
            }
        }

        if (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') {
            const microPlannerPrompt = buildMicroPlannerPromptBlock({
                language,
                phase: nextState.phase,
                topicLabel: plannerTopic?.label || currentTopic.label,
                decision: microPlannerDecision,
                interviewerQuality
            });
            if (microPlannerPrompt) {
                systemPrompt += `\n\n${microPlannerPrompt}`;
            }
            requestLog("🧭 [MICRO_PLANNER]", {
                mode: microPlannerDecision.mode,
                commentStyle: microPlannerDecision.commentStyle,
                focusSubGoal: microPlannerDecision.focusSubGoal,
                signalScore: Number(microPlannerDecision.signalScore.toFixed(2)),
                coverage: microPlannerDecision.topicCoverage,
                knowledgeSource: microPlannerDecision.knowledgeSource,
                crossTopicHint: microPlannerDecision.crossTopicHint || null,
                hesitationHint: microPlannerDecision.hesitationHint || null,
            });

            // Fatigue detection (avanzato only)
            if (tierConfig.naturalness.fatigueDetection) {
                const recentUserMsgs = canonicalMessages
                    .filter(m => m.role === 'user')
                    .slice(-3)
                    .map(m => typeof m.content === 'string' ? m.content : '');
                if (detectFatigue(recentUserMsgs, language)) {
                    systemPrompt += language === 'it'
                        ? `\n\n## FATICA RILEVATA\nL'utente mostra segni di disengagement (risposte brevi/generiche). Accorcia la prossima domanda, rendi il tono più leggero, e valuta se avanzare al sub-goal successivo.`
                        : `\n\n## FATIGUE DETECTED\nThe user shows disengagement signs (short/generic answers). Shorten your next question, lighten the tone, and consider advancing to the next sub-goal.`;
                    console.log("😴 [FATIGUE] Detected — injecting fatigue hint");
                }
            }
        }

        const guardsBlock = buildGuardsBlock({
            userTurnSignal: userTurnSignal === 'none' ? null : userTurnSignal,
            language
        });
        if (guardsBlock) {
            systemPrompt += `\n\n${guardsBlock}`;
        }

        const shouldEndWithQuestion = !['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'].includes(supervisorInsight?.status);
        if (shouldEndWithQuestion) {
            systemPrompt += (language || '').toLowerCase().startsWith('it')
                ? `\n\n## OBBLIGATORIO: La risposta deve terminare con un punto interrogativo (?).`
                : `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;
        }
        if (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') {
            systemPrompt += (language || '').toLowerCase().startsWith('it')
                ? `\n\n## STILE RISPOSTA\nMantieni la risposta visibile breve: massimo 2 frasi. Se fai un aggancio, fallo in una frase corta e concreta, poi fai una sola domanda specifica. Evita formule ripetitive come "è interessante" o "è un punto importante" se non aggiungono informazione.`
                : `\n\n## RESPONSE STYLE\nKeep the visible response short: at most 2 sentences. If you bridge, do it in one short concrete sentence, then ask one specific question. Avoid repetitive fillers like "that's interesting" or "that's an important point" unless they add information.`;
            if (interviewerQuality === 'standard') {
                systemPrompt += (language || '').toLowerCase().startsWith('it')
                    ? `\n\n## MODALITA STANDARD\nResta naturale e conversazionale, ma lavora come un'intervista diagnostica leggera.\n- Copri prima il target previsto del topic corrente; poi passa oltre in modo pulito senza follow-up opzionali.\n- Preferisci domande concrete e confrontabili: pratica attuale, frequenza, ostacolo, chi decide, canale, metrica, esempio recente o prossimo passo.\n- Evita allargamenti filosofici o troppo esplorativi se non servono.`
                    : `\n\n## STANDARD MODE\nStay natural and conversational, but act like a lightweight diagnostic interview.\n- Cover the planned target of the current topic first; then move on cleanly without optional follow-ups.\n- Prefer concrete, comparable questions: current practice, frequency, blocker, owner, channel, metric, recent example, or next step.\n- Avoid philosophical or overly exploratory broadening unless clearly useful.`;
            } else {
                systemPrompt += (language || '').toLowerCase().startsWith('it')
                    ? `\n\n## MODALITA AVANZATA\nScegli il filo piu promettente emerso dall'ultima risposta e resta su quello. Meglio una domanda precisa e distintiva che due piste insieme.`
                    : `\n\n## ADVANCED MODE\nChoose the most promising thread from the last answer and stay on it. One distinctive, precise question is better than two broader angles in the same turn.`;
            }
        }

        // ====================================================================
        // 5. GENERATE RESPONSE
        // ====================================================================
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional()
        });

        let messagesForAI = canonicalMessages.map((m: any) => ({ role: m.role, content: m.content }));
        if (supervisorInsight?.status === 'DATA_COLLECTION_CONSENT') {
            // Small context: consent is stateless, recent 6 messages are enough
            messagesForAI = canonicalMessages.slice(-6).map((m: any) => ({ role: m.role, content: m.content }));
        } else if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            // Bigger context: the AI needs interview history to craft a genuine, contextualised offer
            const deepOfferWindow = interviewerQuality === 'avanzato' ? 12 : 10;
            messagesForAI = canonicalMessages.slice(-deepOfferWindow).map((m: any) => ({ role: m.role, content: m.content }));
        } else if (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') {
            const topicWindow = interviewerQuality === 'avanzato' ? 10 : 6;
            messagesForAI = canonicalMessages.slice(-topicWindow).map((m: any) => ({ role: m.role, content: m.content }));
        }

        const criticalTurnRouting = shouldUseCriticalModelForTopicTurn({
            phase: nextState.phase,
            supervisorStatus: supervisorInsight?.status,
            userTurnSignal,
            userMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
            language,
            criticalEscalation: tierConfig.modelRouting.criticalEscalation
        });
        const modelForMainResponse = nextState.phase === 'DATA_COLLECTION'
            ? dataCollectionModel
            : nextState.phase === 'DEEP_OFFER'
                ? criticalModel
                : criticalTurnRouting.useCritical
                    ? criticalModel
                    : model;
        if (criticalTurnRouting.useCritical && nextState.phase !== 'DATA_COLLECTION' && nextState.phase !== 'DEEP_OFFER') {
            console.log(`🧠 [MODEL_ROUTING] Escalating to critical model for this turn. reason=${criticalTurnRouting.reason}`);
        }

        requestLog("⏳ [CHAT] Generating response...");
        console.time(llmTimerLabel);

        // Integrate validation feedback into system prompt
        const systemPromptWithValidationFeedback = addValidationFeedbackToPrompt(
          systemPrompt,
          supervisorInsight?.validationFeedback,
          language as 'it' | 'en'
        );

        // Inject additional feedback message if present
        const feedbackContext = supervisorInsight?.feedbackMessage
            ? `Previous response feedback: "${supervisorInsight.feedbackMessage.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
            : '';

        const contextWithFeedback = feedbackContext
            ? `${systemPromptWithValidationFeedback}\n\nSUPERVISOR FEEDBACK: ${feedbackContext}`
            : systemPromptWithValidationFeedback;

        // ====================================================================
        // SSE STREAMING PATH (EXPLORE / DEEPEN / DEEP_OFFER only)
        // ====================================================================
        const useStreaming = (
            nextState.phase === 'EXPLORE' ||
            nextState.phase === 'DEEPEN' ||
            nextState.phase === 'DEEP_OFFER'
        ) && !supervisorInsight?.status?.startsWith('DATA_COLLECTION')
          && !simulationMode;

        if (useStreaming) {
            const encoder = new TextEncoder();
            const streamResult = trackedStreamText({
                model: modelForMainResponse,
                messages: messagesForAI,
                system: contextWithFeedback,
                temperature: 0.7,
            });

            const sseStream = new ReadableStream({
                async start(controller) {
                    let fullText = '';
                    const streamTimeoutMs = Math.min((tierConfig.latency?.mainResponseTimeoutMs ?? 8000) * 2, 30000);
                    const streamTimeoutId = setTimeout(() => {
                        console.error('[STREAM] Timeout exceeded, aborting stream');
                        controller.error(new Error('STREAM_TIMEOUT'));
                    }, streamTimeoutMs);
                    try {
                        for await (const chunk of streamResult.textStream) {
                            fullText += chunk;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: chunk })}\n\n`));
                        }
                        clearTimeout(streamTimeoutId);
                    } catch (err) {
                        clearTimeout(streamTimeoutId);
                        console.error('[STREAM] textStream error:', err);
                    }

                    const responseText = fullText || (language === 'it'
                        ? 'Mi dispiace, riprova.'
                        : 'I apologize, please try again.');

                    // --- Post-stream async work (fire-and-forget) ---
                    void (async () => {
                        try {
                            // Record sub-goal history (mirrors the non-streaming path)
                            if ((nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && microPlannerDecision.focusSubGoal) {
                                const history = { ...(nextState.topicSubGoalHistory || {}) };
                                const existing = history[plannerTopicId] || [];
                                if (!existing.includes(microPlannerDecision.focusSubGoal)) {
                                    history[plannerTopicId] = [...existing, microPlannerDecision.focusSubGoal];
                                    nextState.topicSubGoalHistory = history;
                                }
                            }
                            // Persist CIL state
                            // Note: use cilAnalysisRef.current because cilAnalysis const is defined
                            // after the streaming return and would be undefined in this closure.
                            const streamCilAnalysis = cilAnalysisRef.current;
                            if (streamCilAnalysis && isAvanzato) {
                                nextState.cilState = mergeCILState(
                                    state.cilState ?? EMPTY_CIL_STATE,
                                    streamCilAnalysis,
                                    canonicalMessages.length
                                );
                            }
                            await Promise.all([
                                prisma.message.create({
                                    data: {
                                        conversationId,
                                        role: 'assistant',
                                        content: responseText,
                                        metadata: {
                                            ...(clientMessageId ? { replyToClientMessageId: clientMessageId } : {}),
                                            phase: nextState.phase,
                                            supervisorStatus: supervisorInsight?.status ?? null,
                                            topicLabel: targetTopic?.label || currentTopic.label,
                                            topicId: targetTopic?.id || currentTopic.id,
                                            streamedResponse: true,
                                        } as Prisma.InputJsonObject
                                    }
                                }),
                                prisma.conversation.update({
                                    where: { id: conversationId },
                                    data: {
                                        metadata: nextState as any,
                                        currentTopicId: nextTopicId
                                    }
                                })
                            ]);
                            await flushInterviewTokenUsage('standard_response');
                            // Memory update (fire-and-forget)
                            if (lastMessage?.role === 'user') {
                                MemoryManager.updateAfterUserResponse(
                                    conversationId,
                                    lastMessage.content,
                                    currentTopic.id,
                                    currentTopic.label,
                                    openAIKey
                                ).catch(err => console.error("Memory update failed", err));
                            }
                        } catch (persistErr) {
                            console.error('[STREAM] Post-stream persist failed:', persistErr);
                        }
                    })();

                    const meta = {
                        done: true,
                        phase: nextState.phase,
                        isCompleted: false,
                        currentTopicId: nextTopicId,
                        // _freshCandidateProfileCache not yet available here (declared later, populated in DATA_COLLECTION only)
                        candidateProfile: (conversation.candidateProfile as Record<string, string>) ?? {},
                        serverResponseLatencyMs: Date.now() - startTime,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(meta)}\n\n`));
                    controller.close();
                }
            });

            return new Response(sseStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache, no-transform',
                    'X-Accel-Buffering': 'no',
                },
            });
        }

        let result: any;
        try {
            result = await Promise.race([
                trackedGenerateObject({ model: modelForMainResponse, schema, messages: messagesForAI, system: contextWithFeedback, temperature: 0.7 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), tierConfig.latency.mainResponseTimeoutMs))
            ]);
        } catch (error: any) {
            if (error.message === "TIMEOUT") {
                const fallback = language === 'it'
                    ? "Mi scuso, ho bisogno di un momento. Puoi ripetere?"
                    : "I apologize, I need a moment. Could you repeat that?";
                await prisma.message.create({
                    data: {
                        conversationId,
                        role: 'assistant',
                        content: fallback,
                        metadata: clientMessageId
                            ? { replyToClientMessageId: clientMessageId, type: 'timeout_fallback' }
                            : { type: 'timeout_fallback' }
                    }
                });
                await flushInterviewTokenUsage('timeout_fallback');
                return Response.json({
                    text: fallback,
                    currentTopicId: nextTopicId,
                    isCompleted: false,
                    phase: nextState.phase,
                    candidateProfile: (conversation.candidateProfile as Record<string, string>) ?? {},
                    serverResponseLatencyMs: Date.now() - startTime
                });
            }
            const errorName = String(error?.name || '');
            const errorMessage = String(error?.message || '');
            const isObjectValidationFailure =
                errorName.includes('AI_NoObjectGeneratedError') ||
                errorMessage.includes('No object generated') ||
                errorMessage.includes('did not match schema');
            if (isObjectValidationFailure) {
                requestError('⚠️ [LLM] Object schema validation failed. Retrying with fallback strategy.', {
                    name: errorName,
                    message: errorMessage
                });
                try {
                    const minimalSchema = z.object({
                        response: z.string()
                    });
                    const retry = await trackedGenerateObject({
                        model: modelForMainResponse,
                        schema: minimalSchema,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Return ONLY a JSON object with one key: {"response":"..."} and no other keys.`,
                        temperature: 0.6
                    });
                    result = { object: { response: String(retry.object.response || '').trim(), meta_comment: 'minimal_schema_fallback' } };
                } catch (innerError: any) {
                    requestError('⚠️ [LLM] Minimal-schema retry failed. Falling back to generateText.', innerError);
                    const textFallback = await trackedGenerateText({
                        model: modelForMainResponse,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Return plain text only. Do not output JSON.`,
                        temperature: 0.6
                    });
                    result = { object: { response: String(textFallback.text || '').trim(), meta_comment: 'generate_text_fallback' } };
                }
            } else {
            throw error;
            }
        }

        console.timeEnd(llmTimerLabel);
        let responseText = result.object.response;
        requestLog(`🧠 [LLM_REASONING]: ${result.object.meta_comment || 'N/A'}`);
        if (process.env.NODE_ENV === 'development') {
            console.log(`🤖 [LLM_RESPONSE]: "${responseText.substring(0, 100)}..."`);
            console.log("💬 [BOT] Preview:", responseText.slice(0, 400));
        }

        // ====================================================================
        // 5.4 TRANSITION / EXTENSION OFFER ENFORCEMENT (AI-generated, no hardcoded phrasing)
        // ====================================================================
        let didRegenerate = false;
        const qualityTelemetry: QualityTelemetry = {
            eligible: false,
            evaluated: false,
            score: null,
            passed: null,
            gateTriggered: false,
            regenerated: false,
            fallbackUsed: false,
            issues: []
        };
        const flowTelemetry: FlowGuardTelemetry = {
            topicClosureIntercepted: false,
            deepOfferClosureIntercepted: false,
            completionGuardIntercepted: false,
            completionBlockedForConsent: false,
            completionBlockedForMissingField: false,
            questionDedupIntercepted: false
        };
        const deepOfferPreviewHints: string[] = Array.isArray(supervisorInsight.extensionPreview)
            ? supervisorInsight.extensionPreview.map(v => String(v || '').trim()).filter(Boolean).slice(0, 2)
            : [];
        const deepOfferUserSnippets: string[] = Array.isArray(supervisorInsight.extensionUserSnippets)
            ? supervisorInsight.extensionUserSnippets.map(v => String(v || '').trim()).filter(Boolean).slice(0, 1)
            : [];
        const userBridgeHint = lastMessage?.role === 'user'
            ? buildUserBridgeHint(lastMessage.content, language)
            : '';
        const assistantEvaluationCache = new Map<string, Promise<AssistantTurnEvaluation>>();
        const evaluateAssistantResponse = (params?: {
            expectedFieldName?: string | null;
            userMessage?: string | null;
        }): Promise<AssistantTurnEvaluation> => {
            const cacheKey = JSON.stringify({
                responseText,
                expectedFieldName: params?.expectedFieldName || null,
                userMessage: params?.userMessage || null
            });
            const cached = assistantEvaluationCache.get(cacheKey);
            if (cached) return cached;
            const evaluationPromise = evaluateAssistantTurn({
                assistantMessage: responseText,
                apiKey: openAIKey,
                language,
                expectedFieldName: params?.expectedFieldName || null,
                userMessage: params?.userMessage || null,
                options: { onUsage: collectLlmUsage }
            });
            assistantEvaluationCache.set(cacheKey, evaluationPromise);
            return evaluationPromise;
        };

        if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            const deepOfferEvaluation = await evaluateAssistantResponse();
            if (!deepOfferEvaluation.isExtensionOffer) {
                console.log(`⚠️ [SUPERVISOR] Deep offer response not an offer. Regenerating.`);
                try {
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: You must ONLY ask (lightly) if the user wants to extend the interview by a few minutes to continue, and wait for yes/no. Do NOT ask any topic question.`;
                    const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    didRegenerate = true;
                } catch (e) {
                    console.error('Deep offer regeneration failed:', e);
                }
            }

            // Hard enforcement: never leave DEEP_OFFER with a topic question.
            if (!(await evaluateAssistantResponse()).isExtensionOffer) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    extensionUserSnippets: deepOfferUserSnippets,
                    onUsage: collectLlmUsage
                });
                didRegenerate = true;
            }
        }

        // Clarification/scope enforcement on topic phases:
        // if the user asked a clarification or an off-topic question,
        // ensure the assistant acknowledges it explicitly before continuing.
        if (nonHardSafetyRegenerationsEnabled && !didRegenerate && (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && lastMessage?.role === 'user') {
            const topicalEvaluation = await evaluateAssistantResponse({
                userMessage: lastMessage.content
            });
            if (userTurnSignal === 'clarification' && !topicalEvaluation.isClarificationResponse) {
                console.log(`⚠️ [SUPERVISOR] Clarification requested but not handled clearly. Regenerating.`);
                const enforcedSystem = language === 'it'
                    ? `${systemPrompt}\n\nCRITICAL: Rispondi prima al chiarimento in modo diretto e gentile (specifica esattamente cosa intendevi), poi fai UNA sola domanda coerente col topic corrente.`
                    : `${systemPrompt}\n\nCRITICAL: First answer the clarification directly and kindly (state exactly what you meant), then ask ONE coherent follow-up question on the current topic.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.25 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            } else if (userTurnSignal === 'off_topic_question' && !topicalEvaluation.isScopeBoundaryResponse) {
                console.log(`⚠️ [SUPERVISOR] Off-topic user question not bounded. Regenerating with scope boundary.`);
                const enforceTopic = targetTopic?.label || currentTopic.label;
                const enforcedSystem = language === 'it'
                    ? `${systemPrompt}\n\nCRITICAL: Spiega gentilmente in una frase che la domanda dell'utente è fuori scopo per questa intervista, poi riporta il focus su "${enforceTopic}" con UNA sola domanda.`
                    : `${systemPrompt}\n\nCRITICAL: In one polite sentence, explain the user's question is out of scope for this interview, then redirect to "${enforceTopic}" with ONE focused question.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.25 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        const isTopicPhase = nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN';
        if (nonHardSafetyRegenerationsEnabled && isTopicPhase && targetTopic && !didRegenerate) {
            const anchorData = buildTopicAnchors(targetTopic, language);
            const allowUserAnchors = supervisorInsight?.status === 'EXPLORING' || supervisorInsight?.status === 'DEEPENING';
            const userAnchorData = allowUserAnchors && lastMessage?.role === 'user'
                ? buildMessageAnchors(lastMessage.content, language)
                : { anchorRoots: [], anchors: [] };
            const mentionsTopicAnchor = responseMentionsAnchors(responseText, anchorData.anchorRoots);
            const mentionsUserAnchor = allowUserAnchors && responseMentionsAnchors(responseText, userAnchorData.anchorRoots);

            if (anchorData.anchorRoots.length > 0 && !mentionsTopicAnchor && !mentionsUserAnchor) {
                console.log(`⚠️ [SUPERVISOR] Possible topic drift from "${targetTopic.label}". Regenerating with anchors.`);
                const anchorList = anchorData.anchors.slice(0, 5).join(', ');
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Your question must stay on topic "${targetTopic.label}". Include at least ONE of these anchor terms: ${anchorList}. Ask exactly one question.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            }
        }

        if ((nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && !didRegenerate) {
            const assistantHistory = canonicalMessages
                .filter((m: ClientMessage) => m.role === 'assistant')
                .map((m: ClientMessage) => String(m.content || ''))
                .slice(-60);
            const duplicateMatch = findDuplicateQuestionMatch({
                candidateResponse: responseText,
                historyAssistantMessages: assistantHistory,
                language
            });

            if (duplicateMatch.isDuplicate) {
                flowTelemetry.questionDedupIntercepted = true;
                qualityTelemetry.gateTriggered = true;
                const enforceTopic = targetTopic?.label || currentTopic.label;
                console.log(
                    `⚠️ [SUPERVISOR] Duplicate question detected. similarity=${duplicateMatch.similarity.toFixed(2)} reason=${duplicateMatch.reason}. Regenerating.`
                );
                try {
                    responseText = await generateQuestionOnly({
                        model: qualityModel,
                        language,
                        topicLabel: enforceTopic,
                        topicCue: buildNaturalTopicCue(enforceTopic, language),
                        subGoal: supervisorInsight?.nextSubGoal || supervisorInsight?.focusPoint || null,
                        lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                        previousAssistantQuestion: duplicateMatch.matchedQuestion || previousAssistantQuestion,
                        semanticBridgeHint: userBridgeHint,
                        avoidBridgeStems: recentBridgeStems,
                        requireAcknowledgment: interviewerQuality === 'avanzato',
                        transitionMode: supervisorInsight?.transitionMode,
                        interviewerQuality,
                        onUsage: collectLlmUsage
                    });
                    qualityTelemetry.regenerated = true;
                    didRegenerate = true;
                } catch (e) {
                    console.error('Duplicate-question regeneration failed:', e);
                    qualityTelemetry.fallbackUsed = true;
                    responseText = language === 'it'
                        ? 'Su questo punto, quale risultato pratico vorresti ottenere per primo?'
                        : 'On this point, which practical outcome would you like to achieve first?';
                }
            }
        }

        // ====================================================================
        // 5.5 POST-PROCESSING: Detect premature closures and vague responses
        // ====================================================================
        const needsSemanticAssistantEvaluation =
            supervisorInsight?.status === 'DEEP_OFFER_ASK' ||
            nextState.phase === 'DEEP_OFFER' ||
            userTurnSignal === 'clarification' ||
            userTurnSignal === 'off_topic_question';
        const genericAssistantEvaluation: AssistantTurnEvaluation =
            nextState.phase === 'DATA_COLLECTION'
                ? {
                    isExtensionOffer: false,
                    isClarificationResponse: false,
                    isScopeBoundaryResponse: false,
                    isConsentRequest: nextState.consentGiven === false,
                    targetsExpectedField: nextState.consentGiven === true,
                    isClosureResponse: /INTERVIEW_COMPLETED/i.test(responseText),
                    isVagueDataCollectionRequest: false,
                    isContactRequest: true,
                    isPromotionalContent: false
                }
                : needsSemanticAssistantEvaluation
                    ? await evaluateAssistantResponse()
                    : {
                        isExtensionOffer: false,
                        isClarificationResponse: false,
                        isScopeBoundaryResponse: false,
                        isConsentRequest: false,
                        targetsExpectedField: false,
                        isClosureResponse: /INTERVIEW_COMPLETED/i.test(responseText),
                        isVagueDataCollectionRequest: false,
                        isContactRequest: false,
                        isPromotionalContent: false
                    };
        const isGoodbyeResponse = genericAssistantEvaluation.isClosureResponse;
        const isVagueDataRequest = genericAssistantEvaluation.isVagueDataCollectionRequest;
        const hasNoQuestion = !responseText.includes('?');
        const hasCompletionTag = /INTERVIEW_COMPLETED/i.test(responseText);

        // CRITICAL: Detect "goodbye with question" pattern (e.g., "Buona giornata! Ci vediamo?")
        // This is a closure attempt disguised as a question
        const isGoodbyeWithQuestion = isGoodbyeResponse && responseText.includes('?');
        if (isGoodbyeWithQuestion) {
            console.log(`⚠️ [SUPERVISOR] Detected goodbye phrase WITH question mark - treating as closure attempt`);
        }

        // CRITICAL: Detect premature contact requests (bot asking for contacts during SCAN/DEEP)
        const isPrematureContactRequest = genericAssistantEvaluation.isContactRequest && nextState.phase !== 'DATA_COLLECTION';
        if (isPrematureContactRequest) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to ask for contacts during ${nextState.phase} phase - intercepting!`);
        }

        requestLog("🔎 [SUPERVISOR] Flags:", {
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            hasCompletionTag,
            isPrematureContactRequest,
            isVagueDataRequest,
            responseLength: responseText.length
        });

        const shouldBlockTopicClosure = shouldInterceptTopicPhaseClosure({
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            isPrematureContactRequest,
            hasCompletionTag
        });
        const shouldBlockDeepOfferClosure = shouldInterceptDeepOfferClosure({
            phase: nextState.phase,
            isGoodbyeResponse,
            isGoodbyeWithQuestion,
            hasNoQuestion,
            hasCompletionTag
        });

        const isPromoContent = genericAssistantEvaluation.isPromotionalContent && (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN' || nextState.phase === 'DEEP_OFFER');
        if (isPromoContent) {
            console.log(`⚠️ [SUPERVISOR] Promo/CTA detected during active phase. Regenerating.`);
            const enforceTopic = targetTopic?.label || currentTopic.label;
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Remove any promo/CTA. Ask exactly ONE question about "${enforceTopic}".`;
            const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

        // Lazy cache: profile may be updated earlier this request — fetch once, reuse everywhere
        let _freshCandidateProfileCache: Record<string, unknown> | undefined
        const getFreshCandidateProfile = async (): Promise<Record<string, unknown>> => {
            if (_freshCandidateProfileCache === undefined) {
                const r = await prisma.conversation.findUnique({
                    where: { id: conversationId },
                    select: { candidateProfile: true },
                })
                _freshCandidateProfileCache = (r?.candidateProfile as Record<string, unknown>) ?? {}
            }
            return _freshCandidateProfileCache
        }

        // If in DATA_COLLECTION phase, ALWAYS ensure we ask for the specific field
        if (nextState.phase === 'DATA_COLLECTION') {
            if (nextState.dataCollectionRefused || supervisorInsight?.status === 'COMPLETE_WITHOUT_DATA') {
                console.log(`⚠️ [SUPERVISOR] Forcing final closure after data collection refusal/completion.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Conclude the interview now. Thank the user, and if a reward is configured, provide it. Do NOT ask any questions. Append "INTERVIEW_COMPLETED".`;
                try {
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Final closure regeneration failed:', e);
                }
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                }
            } else {
                const candidateFields = (bot.candidateDataFields as any[]) || [];
                const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);

                // CRITICAL: Re-read profile from DB to get updated values after extraction
                // The `conversation.candidateProfile` is stale (from start of request)
                const currentProfile = await getFreshCandidateProfile();

                // Find first missing field (must match logic in data collection phase)
                // Consider: already collected, explicitly skipped, or asked too many times
                const MAX_FIELD_ATTEMPTS_SUPERVISOR = 3;
                const missingField = getNextMissingCandidateField(
                    candidateFieldIds,
                    currentProfile,
                    nextState.fieldAttemptCounts,
                    MAX_FIELD_ATTEMPTS_SUPERVISOR
                );

                // CONSENT PHASE: bot should ask for permission
                const forceConsent = nextState.forceConsentQuestion === true;
                if ((forceConsent || nextState.consentGiven === false) && !nextState.dataCollectionRefused) {
                    let assistantEvaluation = await evaluateAssistantResponse();
                    let isConsent = assistantEvaluation.isConsentRequest;

                    if (!isConsent || forceConsent) {
                        console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. OVERRIDING with consent question.`);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Start with one short linking sentence acknowledging the content interview is complete, then ask ONLY one yes/no consent question to collect contact details. Do not ask topic questions.`;
                        const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                        responseText = retry.object.response?.trim() || responseText;

                        assistantEvaluation = await evaluateAssistantResponse();
                        if (!assistantEvaluation.isConsentRequest) {
                            const enforcedSystem2 = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                            const retry2 = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem2, temperature: 0.1 });
                            responseText = retry2.object.response?.trim() || responseText;
                        }
                    }
                    if (forceConsent) {
                        nextState.forceConsentQuestion = false;
                    }
                }
                // FIELD COLLECTION PHASE: bot should ask for specific field
                else if (nextState.consentGiven === true && missingField) {
                    // Only override if the response doesn't already ask for this field
                    const fieldMentioned = (await evaluateAssistantResponse({
                        expectedFieldName: missingField
                    })).targetsExpectedField;

                    if (!fieldMentioned || hasNoQuestion) {
                        console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". OVERRIDING with field question.`);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask ONLY for the canonical field id "${missingField}". Write the question in the participant's language. One question only.`;
                        const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                        responseText = retry.object.response?.trim() || responseText;
                    }
                }
                // ALL FIELDS COLLECTED but bot didn't complete
                else if (!missingField && !responseText.includes('INTERVIEW_COMPLETED')) {
                    console.log(`✅ [SUPERVISOR] All fields collected, adding completion tag.`);
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append \"INTERVIEW_COMPLETED\". Do not ask any questions.`;
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                    if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                        responseText = `${responseText.trim()} INTERVIEW_COMPLETED`.trim();
                    }
                }
            }
        }
        // Other phases - Handle bot trying to close during SCAN/DEEP
        // NEW STRATEGY: Track closure attempts and respect user's intent after 2 attempts
        else if (shouldBlockTopicClosure) {
            flowTelemetry.topicClosureIntercepted = true;
            const maxDurationSec = maxDurationMins * 60;
            const remainingSec = maxDurationSec - effectiveSec;
            const shouldOfferExtraTime = nextState.phase === 'DEEPEN' && remainingSec <= 0 && state.deepAccepted !== true;

            if (shouldOfferExtraTime) {
                console.log(`⚠️ [SUPERVISOR] Closure attempt while time is over. Switching to extension offer.`);
                const returnPhase: 'EXPLORE' | 'DEEPEN' = state.phase === 'EXPLORE' ? 'EXPLORE' : 'DEEPEN';
                nextState.phase = 'DEEP_OFFER';
                nextState.deepAccepted = false;
                nextState.extensionReturnPhase = returnPhase;
                nextState.extensionReturnTopicIndex = state.topicIndex;
                nextState.extensionReturnTurnInTopic = state.turnInTopic;
                nextState.extensionOfferAttempts = 0;
                supervisorInsight = buildDeepOfferInsight(nextState);
                try {
                    const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask (lightly) if the user wants to extend the interview by a few minutes to continue. One question only.`;
                    const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Extension offer regeneration after closure failed:', e);
                }
            } else {
                nextState.closureAttempts = (state.closureAttempts || 0) + 1;
                console.log(`⚠️ [SUPERVISOR] Bot tried to close during ${nextState.phase} phase. Forcing topic question. Attempt #${nextState.closureAttempts}`);

                const enforceTopic = targetTopic?.label || currentTopic.label;
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT end the interview. Ask exactly ONE question about the topic "${enforceTopic}". Do not mention contacts, rewards, or closing. The response MUST end with a question mark.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
                if (process.env.NODE_ENV === 'development') console.log("🧭 [SUPERVISOR] Override response:", responseText.slice(0, 300));

                // If the override still isn't a proper question, use fallback question-only generation (MAX 1 retry)
                const stillBad = !responseText.includes('?') || (await evaluateAssistantResponse()).isClosureResponse;
                if (stillBad) {
                    console.log("🧭 [SUPERVISOR] Override still invalid, using fallback question-only generation.");
                    try {
                        responseText = await generateQuestionOnly({
                            model: qualityModel,
                            language,
                            topicLabel: enforceTopic,
                            topicCue: buildNaturalTopicCue(enforceTopic, language),
                            lastUserMessage: lastMessage?.role === 'user' ? lastMessage.content : null,
                            previousAssistantQuestion,
                            semanticBridgeHint: userBridgeHint,
                            avoidBridgeStems: recentBridgeStems,
                            requireAcknowledgment: interviewerQuality === 'avanzato',
                            interviewerQuality,
                            onUsage: collectLlmUsage
                        });
                        if (process.env.NODE_ENV === 'development') console.log("🧭 [SUPERVISOR] Question-only response:", responseText.slice(0, 300));
                    } catch (e) {
                        console.error("Question-only generation failed:", e);
                        // Final fallback: simple question
                        const fallbackQuestion = language === 'it'
                            ? `Puoi dirmi di più su ${enforceTopic}?`
                            : `Can you tell me more about ${enforceTopic}?`;
                        responseText = fallbackQuestion;
                    }
                }
            }
        }
        // Reset closure attempts when bot generates a valid question (not trying to close)
        else if ((nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && !isGoodbyeResponse && !hasNoQuestion) {
            nextState.closureAttempts = 0;
        }
        else if (shouldBlockDeepOfferClosure) {
            flowTelemetry.deepOfferClosureIntercepted = true;
            console.log(`⚠️ [SUPERVISOR] Bot tried to close during DEEP_OFFER. OVERRIDING with offer question.`);
            try {
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Offer the choice to extend the interview by a few minutes and continue. One question only. Do not ask any topic question.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
                responseText = retry.object.response?.trim() || responseText;
            } catch (e) {
                console.error('Deep offer closure regeneration failed:', e);
            }
            if (!(await evaluateAssistantResponse()).isExtensionOffer) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    extensionUserSnippets: deepOfferUserSnippets,
                    onUsage: collectLlmUsage
                });
            }
        }

        // ====================================================================
        // QUALITATIVE GUARDRAILS (naturalness-first, light-touch corrections)
        // ====================================================================
        // NOTE: Disabled in v2 - quality pipeline removed. ENABLE_SOFT_QUALITY_GUARDS is false anyway.
        // const qualityGatePhases = new Set(['EXPLORE', 'DEEPEN', 'DEEP_OFFER']);
        // qualityTelemetry.eligible = softQualityGuardsEnabled && qualityGatePhases.has(nextState.phase);
        //
        // if (softQualityGuardsEnabled && qualityGatePhases.has(nextState.phase) && lastMessage?.role === 'user' && !/INTERVIEW_COMPLETED/i.test(responseText)) {
        //     ... (quality evaluation disabled in v2)
        // }

        // ====================================================================
        // FINAL SAFETY NET: Only intervene for critical issues
        // ====================================================================
        // NOTE: Disabled in v2 - safety nets will be re-implemented with proper helper functions.
        // The buildAdditiveQuestionPrompt function was removed as part of quality pipeline cleanup.
        // if (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') { ... }

        // DEEP_OFFER safety: must be an extension-consent question
        if (nextState.phase === 'DEEP_OFFER') {
            const invalidDeepOffer =
                !(await evaluateAssistantResponse()).isExtensionOffer ||
                (await evaluateAssistantResponse()).isClosureResponse ||
                /INTERVIEW_COMPLETED/i.test(responseText);
            if (invalidDeepOffer) {
                flowTelemetry.deepOfferClosureIntercepted = true;
                console.log(`🛡️ [SAFETY_NET] Invalid DEEP_OFFER response, fixing...`);
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    extensionUserSnippets: deepOfferUserSnippets,
                    onUsage: collectLlmUsage
                });
            }
        }

        // Final fail-safe for DATA_COLLECTION:
        // keep phase-consistent behavior even when previous regenerations drift.
        if (nextState.phase === 'DATA_COLLECTION' && !nextState.dataCollectionRefused && supervisorInsight?.status !== 'COMPLETE_WITHOUT_DATA') {
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const currentProfileForDataGuard = await getFreshCandidateProfile();
            const missingFieldForDataGuard = getNextMissingCandidateField(
                candidateFieldIds,
                currentProfileForDataGuard,
                nextState.fieldAttemptCounts,
                3
            );

            const needsConsentQuestion = nextState.forceConsentQuestion === true || nextState.consentGiven === false;
            const hasQuestionNow = responseText.includes('?');
            const hasCompletionTagNow = /INTERVIEW_COMPLETED/i.test(responseText);
            const hasGoodbyeNow = (await evaluateAssistantResponse()).isClosureResponse;

            if (needsConsentQuestion) {
                const assistantEvaluation = await evaluateAssistantResponse();
                const invalidConsentResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !assistantEvaluation.isConsentRequest;
                if (invalidConsentResponse) {
                    console.log('🛡️ [FINAL_GUARD] DATA_COLLECTION consent response invalid. Forcing consent question.');
                    try {
                        responseText = await generateConsentQuestionOnly({
                            model: dataCollectionModel,
                            language,
                            onUsage: collectLlmUsage
                        });
                    } catch (e) {
                        console.error('Consent question fallback failed:', e);
                        responseText = normalizeSingleQuestion(String(responseText || '').replace(/INTERVIEW_COMPLETED/gi, '').trim());
                    }
                }
                nextState.forceConsentQuestion = false;
            } else if (nextState.consentGiven === true && missingFieldForDataGuard) {
                const fieldMentioned = (await evaluateAssistantResponse({
                    expectedFieldName: missingFieldForDataGuard
                })).targetsExpectedField;
                const invalidFieldResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !fieldMentioned;
                if (invalidFieldResponse) {
                    console.log(`🛡️ [FINAL_GUARD] DATA_COLLECTION field response invalid for "${missingFieldForDataGuard}". Forcing field question.`);
                    try {
                        responseText = await generateFieldQuestionOnly({
                            model: dataCollectionModel,
                            language,
                            fieldLabel: missingFieldForDataGuard,
                            onUsage: collectLlmUsage
                        });
                    } catch (e) {
                        console.error('Field question fallback failed:', e);
                        responseText = normalizeSingleQuestion(String(responseText || '').replace(/INTERVIEW_COMPLETED/gi, '').trim());
                    }
                }
            } else if (nextState.consentGiven === true && !missingFieldForDataGuard && !hasCompletionTagNow) {
                console.log('🛡️ [FINAL_GUARD] DATA_COLLECTION complete but missing completion tag. Forcing final goodbye.');
                try {
                    const retry = await trackedGenerateObject({
                        model: dataCollectionModel,
                        schema,
                        messages: messagesForAI,
                        system: `${systemPrompt}\n\nCRITICAL: Thank the user, close the interview, and append "INTERVIEW_COMPLETED". Do NOT ask any questions.`,
                        temperature: 0.2
                    });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Final goodbye fallback failed:', e);
                }
                if (!/INTERVIEW_COMPLETED/i.test(responseText)) {
                    const noQuestionTail = String(responseText || '').replace(/[?]+$/g, '').trim();
                    responseText = `${noQuestionTail} INTERVIEW_COMPLETED`.trim();
                }
            }
        }

        const [refreshedRuntimeInterviewKnowledge, freshCilAnalysis] = await Promise.all([
            resolveWithin(runtimeInterviewKnowledgeRefreshPromise, SOFT_STATE_ENRICHMENT_WAIT_MS),
            resolveWithin(cilAnalysisPromise, SOFT_STATE_ENRICHMENT_WAIT_MS)
        ]);
        if (refreshedRuntimeInterviewKnowledge) {
            nextState.runtimeInterviewKnowledge = refreshedRuntimeInterviewKnowledge;
            nextState.runtimeInterviewKnowledgeSignature = runtimeKnowledgeSignature;
        }
        const cilAnalysis = freshCilAnalysis;
        if (cilAnalysis?.budgetSignal && isAvanzato) {
            const cap = computeCILBonusCap(nextState, (bot as any).cilBonusTurnCapOverride ?? null);
            nextState = applyCILBudgetSignal(nextState, cilAnalysis.budgetSignal, cap);
        }

        let interactionPayload: InterviewInteractionPayload | null = null;
        if (nextState.phase === 'DATA_COLLECTION' && !nextState.dataCollectionRefused && supervisorInsight?.status !== 'COMPLETE_WITHOUT_DATA') {
            const candidateFieldsForInteraction = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIdsForInteraction = normalizeCandidateFieldIds(candidateFieldsForInteraction);
            const currentProfileForInteraction = await getFreshCandidateProfile();
            const missingFieldForInteraction = getNextMissingCandidateField(
                candidateFieldIdsForInteraction,
                currentProfileForInteraction,
                nextState.fieldAttemptCounts,
                3
            );
            const interactionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            if (nextState.consentGiven === false && !nextState.forceConsentQuestion) {
                interactionPayload = buildDataCollectionInteractionPayload({
                    interactionId,
                    consentPending: true
                });
            } else if (nextState.forceConsentQuestion === true) {
                interactionPayload = buildDataCollectionInteractionPayload({
                    interactionId,
                    consentPending: true
                });
            } else if (nextState.consentGiven === true && missingFieldForInteraction) {
                interactionPayload = buildDataCollectionInteractionPayload({
                    interactionId,
                    fieldId: missingFieldForInteraction,
                    candidateFields: candidateFieldsForInteraction,
                    allowSkip: true
                });
            }
        }

        nextState.activeInteractionId = interactionPayload?.interactionId ?? null;
        nextState.activeInteractionKind = interactionPayload?.kind ?? null;
        nextState.activeInteractionFieldId = interactionPayload?.kind === 'field'
            ? interactionPayload.fieldId
            : null;

        const buildAssistantMetadata = (isCompletion: boolean = false): Prisma.InputJsonObject => {
            const plannerPlanTopic = (interviewPlan.explore?.topics || []).find((topic) => topic.topicId === plannerTopicId) || null;
            const focusedSubGoal = microPlannerDecision?.focusSubGoal || null;
            const focusedSubGoalPlan = plannerPlanTopic?.subGoalPlans?.find((subGoal) => subGoal.label === focusedSubGoal) || null;
            const highValueTurn = topicTurnDecision?.highValue ?? ((nextState.lastSignalScore || 0) >= 0.42);
            return {
                ...(clientMessageId ? { replyToClientMessageId: clientMessageId } : {}),
                phase: nextState.phase,
                supervisorStatus: supervisorInsight?.status ?? null,
                reasoning: result?.object?.meta_comment ?? null,
                topicLabel: targetTopic?.label || currentTopic.label,
                topicId: targetTopic?.id || currentTopic.id,
                topicImportanceScore: plannerPlanTopic?.importanceScore ?? null,
                topicImportanceBand: plannerPlanTopic?.importanceBand ?? null,
                topicCoverageTierCounts: plannerPlanTopic ? {
                    target: plannerPlanTopic.targetSubGoalCount,
                    stretch: plannerPlanTopic.stretchSubGoalCount,
                    full: plannerPlanTopic.fullCoverageSubGoalCount,
                } : null,
                subGoal: focusedSubGoal,
                subGoalId: focusedSubGoalPlan?.id ?? null,
                subGoalImportanceScore: focusedSubGoalPlan?.importanceScore ?? null,
                subGoalImportanceBand: focusedSubGoalPlan?.importanceBand ?? null,
                subGoalCoverageTier: focusedSubGoalPlan?.coverageTier ?? null,
                userTurnSignal,
                responseValue: topicTurnDecision?.responseValue ?? null,
                deltaType: topicTurnDecision?.deltaType ?? null,
                narrativeState: topicTurnDecision?.narrativeState ?? null,
                nextAction: topicTurnDecision?.nextAction ?? null,
                decisionRationale: topicTurnDecision?.rationale ?? null,
                remainingTargetSubGoalsAtDecision: topicTurnRemainingTargetSubGoals,
                remainingStretchSubGoalsAtDecision: topicTurnRemainingStretchSubGoals,
                highValueTurn,
                quality: qualityTelemetry as unknown as Prisma.InputJsonValue,
                flowFlags: flowTelemetry as unknown as Prisma.InputJsonValue,
                llmUsage: getLlmUsageSnapshot() as unknown as Prisma.InputJsonValue,
                responseLatencyMs: Date.now() - startTime,
                simulationMode,
                abVariant,
                interactionPayload: interactionPayload as unknown as Prisma.InputJsonValue,
                ...(isCompletion ? { isCompletion: true } : {})
            };
        };

        // Check for completion tag - only valid if we're actually done
        if (/INTERVIEW_COMPLETED/i.test(responseText)) {
            // Verify we're actually done - MUST re-read from DB for fresh data
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const currentProfileForCompletion = await getFreshCandidateProfile();
            // A field is considered "done" if: collected, skipped, or asked too many times
            const MAX_FIELD_ATTEMPTS_COMPLETION = 3;
            const missingFieldForCompletion = getNextMissingCandidateField(
                candidateFieldIds,
                currentProfileForCompletion,
                nextState.fieldAttemptCounts,
                MAX_FIELD_ATTEMPTS_COMPLETION
            );
            const completionGuardAction = getCompletionGuardAction({
                shouldCollectData,
                candidateFieldIds,
                consentGiven: nextState.consentGiven,
                dataCollectionRefused: nextState.dataCollectionRefused,
                missingField: missingFieldForCompletion
            });

            if (completionGuardAction === 'ask_consent') {
                flowTelemetry.completionGuardIntercepted = true;
                flowTelemetry.completionBlockedForConsent = true;
                supervisorInsight = alignStateWithCompletionGuard({
                    action: 'ask_consent',
                    nextState
                });
                // Guardrail: never allow completion before an explicit contact-consent step.
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED before consent resolution. OVERRIDING with consent question.`);
                const enforcedSystem = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                try {
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Consent regeneration after completion failed:', e);
                }
            } else if (completionGuardAction === 'ask_missing_field' && missingFieldForCompletion) {
                flowTelemetry.completionGuardIntercepted = true;
                flowTelemetry.completionBlockedForMissingField = true;
                supervisorInsight = alignStateWithCompletionGuard({
                    action: 'ask_missing_field',
                    nextState,
                    missingField: missingFieldForCompletion
                });
                // Guardrail: consent granted but fields still missing -> ask the specific field, not completion.
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED but "${missingFieldForCompletion}" is still missing. OVERRIDING with field question.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT conclude. Ask ONLY for the canonical field id "${missingFieldForCompletion}". Write the question in the participant's language. One question only.`;
                try {
                    const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                    responseText = retry.object.response?.trim() || responseText;
                } catch (e) {
                    console.error('Field regeneration after premature completion failed:', e);
                }
            } else {
                // Actually complete
                await completeInterview(
                    conversationId,
                    canonicalMessages,
                    openAIKey,
                    currentProfileForCompletion || {},
                    { simulationMode, onLlmUsage: collectLlmUsage, language, effectiveDuration: typeof effectiveDuration === 'number' ? effectiveDuration : null }
                );
                const finalResponseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();
                void prisma.message.create({
                    data: {
                        conversationId,
                        role: 'assistant',
                        content: finalResponseText,
                        metadata: buildAssistantMetadata(true)
                    }
                }).catch(err => console.error('[persist] DB write failed on completion (non-blocking):', err));
                void flushInterviewTokenUsage('completed_response')
                    .catch(err => console.error('[flush] token usage failed on completion (non-blocking):', err));
                // Record sub-goal used this turn on completion path
                if ((nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && microPlannerDecision.focusSubGoal) {
                    const history = { ...(nextState.topicSubGoalHistory || {}) };
                    const existing = history[plannerTopicId] || [];
                    if (!existing.includes(microPlannerDecision.focusSubGoal)) {
                        history[plannerTopicId] = [...existing, microPlannerDecision.focusSubGoal];
                        nextState.topicSubGoalHistory = history;
                    }
                }
                // Persist CIL state before completion return
                if (cilAnalysis && isAvanzato) {
                    nextState.cilState = mergeCILState(
                        state.cilState ?? EMPTY_CIL_STATE,
                        cilAnalysis,
                        canonicalMessages.length
                    );
                }
                return Response.json({
                    text: finalResponseText,
                    currentTopicId: nextTopicId,
                    isCompleted: true,
                    interactionPayload: null,
                    phase: nextState.phase,
                    candidateProfile: currentProfileForCompletion ?? conversation.candidateProfile ?? {},
                    serverResponseLatencyMs: Date.now() - startTime
                });
            }
        }

        // Record the sub-goal used this turn so micro-planner advances on next turn
        if ((nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && microPlannerDecision.focusSubGoal) {
            const history = { ...(nextState.topicSubGoalHistory || {}) };
            const existing = history[plannerTopicId] || [];
            if (!existing.includes(microPlannerDecision.focusSubGoal)) {
                history[plannerTopicId] = [...existing, microPlannerDecision.focusSubGoal];
                nextState.topicSubGoalHistory = history;
            }
        }

        // ====================================================================
        // 6. SAVE & UPDATE STATE (parallelized for speed)
        // ====================================================================

        // Persist CIL state
        if (cilAnalysis && isAvanzato) {
            nextState.cilState = mergeCILState(
                state.cilState ?? EMPTY_CIL_STATE,
                cilAnalysis,
                canonicalMessages.length
            );
        }

        const totalTime = Date.now() - startTime;
        requestLog(`✅ Finished. Response sent. Next Phase: ${nextState.phase}`);
        requestLog(`⏱️ TOTAL REQUEST: ${totalTime}ms`);

        const responsePayload = Response.json({
            text: responseText,
            currentTopicId: nextTopicId,
            isCompleted: false,
            interactionPayload,
            phase: nextState.phase,
            candidateProfile: _freshCandidateProfileCache ?? conversation.candidateProfile ?? {},
            serverResponseLatencyMs: Date.now() - startTime
        });

        // Fire-and-forget: client doesn't need to wait for DB persistence
        void Promise.all([
            prisma.message.create({
                data: {
                    conversationId,
                    role: 'assistant',
                    content: responseText,
                    metadata: buildAssistantMetadata(false)
                }
            }),
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: nextState as any,
                    currentTopicId: nextTopicId
                }
            })
        ]).catch(err => console.error('[persist] DB write failed (non-blocking):', err));

        void flushInterviewTokenUsage('standard_response')
            .catch(err => console.error('[flush] token usage failed (non-blocking):', err));

        // Memory update (fire and forget - don't block response)
        if (lastMessage?.role === 'user') {
            MemoryManager.updateAfterUserResponse(
                conversationId,
                lastMessage.content,
                currentTopic.id,
                currentTopic.label,
                openAIKey
            ).catch(err => console.error("Memory update failed", err));
        }

        return responsePayload;

    } catch (error: any) {
        console.error("Chat API Error:", error);
        await flushInterviewTokenUsage('error_fallback');
        const safeFallback = "Mi dispiace, c'è stato un problema temporaneo. Possiamo riprendere da dove eravamo?";
        return Response.json(
            {
                text: safeFallback,
                currentTopicId: null,
                isCompleted: false,
                degraded: true,
                serverResponseLatencyMs: Date.now() - startTime,
                error: String(error?.message || 'unknown_error')
            },
            { status: 200 }
        );
    }
}
