
import { ChatService } from '@/services/chat-service';
import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PromptBuilder, addValidationFeedbackToPrompt } from '@/lib/llm/prompt-builder';
import { LLMService, type InterviewRuntimeModels } from '@/services/llmService';
import { TopicManager } from '@/lib/llm/topic-manager';
import { MemoryManager } from '@/lib/memory/memory-manager';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { getOrCreateInterviewPlan } from '@/lib/interview/plan-service';
import type { InterviewPlan } from '@/lib/interview/plan-types';
import { buildTopicAnchors, buildMessageAnchors, responseMentionsAnchors } from '@/lib/interview/topic-anchors';
import { getFieldLabel, getNextMissingCandidateField } from '@/lib/interview/flow-guards';
import { validateExtractedField } from '@/lib/interview/field-validation';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { getCompletionGuardAction, shouldInterceptDeepOfferClosure, shouldInterceptTopicPhaseClosure } from '@/lib/interview/phase-flow';
// NOTE: v2 post-processing moved to post-processing-v2.ts - quality gates removed
import { extractDeterministicFieldValue, isLikelyNonValueAck, normalizeCandidateFieldIds, responseMentionsCandidateField } from '@/lib/interview/data-collection-guard';
import { createDeepOfferInsight, createDefaultSupervisorInsight, runDeepOfferPhase, type InterviewStateLike, type Phase, type SupervisorInsight, type TransitionMode } from '@/lib/interview/interview-supervisor';
import type { ValidationResponse } from '@/lib/interview/validation-response';
import { findDuplicateQuestionMatch } from '@/lib/interview/question-dedup';
import { handleExplorePhase, handleDeepenPhase } from '@/lib/interview/explore-deepen-machine';
import { computeSignalScore } from '@/lib/interview/signal-score';
import { buildTurnGuidanceBlock, buildGuardsBlock } from '@/lib/llm/runtime-prompt-blocks';
import { runPostProcessing } from '@/lib/interview/post-processing-v2';
import {
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

import {
    InterestingTopic, TopicBudget,
    extractSnippet, computeEngagementScore, shouldUseCriticalModelForTopicTurn,
    ITALIAN_STOPWORDS, ENGLISH_STOPWORDS, tokenizeForScoring, lexicalOverlapScore,
    buildTopicSemanticText, getDeepTopics, buildDeepTopicOrder,
    getScanPlanTurns, getDeepPlanTurns, getRemainingSubGoals,
    buildDeepPlan, selectDeepFocusPoint, buildExtensionPreviewHints,
    sanitizeUserSnippet,
} from '@/lib/chat/context-helpers';
import {
    isExtensionOfferQuestion, generateConsentQuestionOnly, generateFieldQuestionOnly,
    extractLastAssistantQuestion, buildUserBridgeHint,
    buildRuntimeSemanticContextPrompt,
    normalizeSingleQuestion,
    collectRecentBridgeStems,
    detectUserTurnSignal, isClarificationHandledResponse,
    isScopeBoundaryHandledResponse, buildNaturalTopicCue,
    type UserTurnSignal,
} from '@/lib/chat/response-builder';
import {
    extractFieldFromMessage,
    checkUserIntent,
    detectExplicitClosureIntent,
    type LLMUsageCollector,
    type LLMUsagePayload,
} from '@/lib/interview/chat-intent';
import {
    generateQuestionOnly,
    generateDeepOfferOnly,
    enforceDeepOfferQuestion,
} from '@/lib/interview/question-generator';
import { completeInterview } from '@/lib/interview/interview-completion';
import { ToneAnalyzer } from '@/lib/tone/tone-analyzer';
import { buildToneAdaptationPrompt } from '@/lib/tone/tone-prompt-adapter';
export const maxDuration = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    MAX_DATA_COLLECTION_ATTEMPTS: 15,
    SAFETY_MAX_ASSISTANT_TURNS: 120,
    SAFETY_MAX_TOTAL_MESSAGES: 260,
};
const ENABLE_SOFT_QUALITY_GUARDS = false;
const ENABLE_NON_HARD_SAFETY_REGENERATIONS = false;
type InterviewAbVariant = 'control' | 'treatment';

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
    extensionReturnPhase?: 'SCAN' | 'DEEP' | null;
    extensionReturnTopicIndex?: number | null;
    extensionReturnTurnInTopic?: number | null;
    extensionOfferAttempts?: number;
    runtimeInterviewKnowledge?: RuntimeInterviewKnowledge | null;
    runtimeInterviewKnowledgeSignature?: string | null;
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
    clientMessageId: z.string().min(8).max(128).optional()
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
                { error: 'Invalid chat payload', details: parsedBody.error.issues },
                { status: 400 }
            );
        }

        const {
            messages: incomingMessages,
            conversationId,
            botId,
            effectiveDuration,
            introMessage,
            clientMessageId
        } = parsedBody.data;
        console.log(`\n🚀 [CHAT_API] Processing message for conversation: ${conversationId}`);
        if (simulationMode) {
            console.log('🧪 [CHAT_API] Local simulation mode enabled (credits and usage side effects disabled).');
        }
        console.log(`🧪 [AB] Variant=${abVariant} softGuards=${softQualityGuardsEnabled} nonHardRegens=${nonHardSafetyRegenerationsEnabled}`);

        // ====================================================================
        // 1. LOAD DATA (with parallel operations for speed)
        // ====================================================================
        const loadStart = Date.now();
        const conversation = await ChatService.loadConversation(conversationId, botId);
        console.log(`⏱️ [TIMING] Data load: ${Date.now() - loadStart}ms`);
        const bot = conversation.bot;
        const language = bot.language || 'en';
        const interviewObjective = String((bot as any).researchGoal || '').trim();
        const shouldCollectData = (bot as any).collectCandidateData;
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
                    isCompleted: conversation.status === 'COMPLETED'
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
                        metadata: { clientMessageId }
                    }
                });
            }

            return ChatService.saveUserMessage(conversationId, lastIncomingMessage.content);
        })();

        const [savedUserMessage, , openAIKey, runtimeModels] = await Promise.all([
            saveUserMessagePromise,
            // Update progress
            ChatService.updateProgress(conversationId, safeEffectiveDuration),
            // Get API key
            LLMService.getApiKey(bot, 'openai').then(key => key || process.env.OPENAI_API_KEY || ''),
            // Pre-fetch routed models (primary + critical paths)
            LLMService.getInterviewRuntimeModels(bot)
        ]);
        console.log(`⏱️ [TIMING] Parallel ops: ${Date.now() - parallelStart}ms`);

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
                { simulationMode, onLlmUsage: collectLlmUsage, language }
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
                isCompleted: true
            });
        }

        // Topics
        const botTopics = [...bot.topics].sort((a, b) => a.orderIndex - b.orderIndex);
        const numTopics = botTopics.length;
        const interviewPlan = await getOrCreateInterviewPlan(bot);
        console.log("📊 [PLAN] Meta:", {
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
            extensionReturnPhase: rawMetadata.extensionReturnPhase ?? null,
            extensionReturnTopicIndex: rawMetadata.extensionReturnTopicIndex ?? null,
            extensionReturnTurnInTopic: rawMetadata.extensionReturnTurnInTopic ?? null,
            extensionOfferAttempts: rawMetadata.extensionOfferAttempts ?? 0,
            runtimeInterviewKnowledge: rawMetadata.runtimeInterviewKnowledge ?? null,
            runtimeInterviewKnowledgeSignature: rawMetadata.runtimeInterviewKnowledgeSignature ?? null,
        };

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
            plan: interviewPlan
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
        const shouldPrepareRuntimeKnowledge =
            (state.phase === 'EXPLORE' || state.phase === 'DEEPEN') &&
            !manualInterviewGuide &&
            !hasValidRuntimeKnowledge;
        const runtimeInterviewKnowledgePromise: Promise<RuntimeInterviewKnowledge | null> = shouldPrepareRuntimeKnowledge
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
                timeoutMs: 1200,
                onUsage: collectLlmUsage
            })
            : Promise.resolve(hasValidRuntimeKnowledge ? state.runtimeInterviewKnowledge || null : null);

        console.log(`📊 [STATE] Phase: ${state.phase}, Topic: ${currentTopic.label}, Index: ${state.topicIndex}, Turn: ${state.turnInTopic}`);
        console.log(`⏱️ [TIME] Effective: ${effectiveSec}s / Max: ${maxDurationMins}m`);
        if (process.env.NODE_ENV === 'development' && lastMessage?.role === 'user') {
            const userPreview = String(lastMessage.content || '').slice(0, 400);
            console.log("💬 [USER] Preview:", userPreview);
        }

        console.log("📊 [CHAT] State:", {
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
        const nextState = { ...state };
        let systemPrompt = "";
        let nextTopicId = currentTopic.id;
        let supervisorInsight: SupervisorInsight = createDefaultSupervisorInsight();
        const buildDeepOfferInsight = (
            sourceState: InterviewState,
            validationFeedback?: ValidationResponse
        ) => {
            const extensionPreview = buildExtensionPreviewHints({
                botTopics,
                deepOrder: sourceState.deepTopicOrder,
                history: sourceState.topicSubGoalHistory,
                interestingTopics: sourceState.interestingTopics,
                interviewObjective,
                language,
                startIndex: sourceState.topicIndex,
                maxItems: 2
            });
            return createDeepOfferInsight(extensionPreview, validationFeedback);
        };

        if (lastMessage?.role === 'user') {
            nextState.lastUserTopicId = currentTopic.id;
        }

        let forceEarlyClosureFromUser = false;
        // Skip closure detection in DEEP_OFFER phase - it has its own logic to handle REFUSE vs ACCEPT
        if (lastMessage?.role === 'user' && state.phase !== 'DATA_COLLECTION' && state.phase !== 'DEEP_OFFER') {
            const closureIntent = await detectExplicitClosureIntent(
                lastMessage.content,
                openAIKey,
                language,
                { onUsage: collectLlmUsage }
            );
            if (closureIntent.wantsToConclude && closureIntent.confidence !== 'low') {
                forceEarlyClosureFromUser = true;
                console.log(`🛑 [SUPERVISOR] Explicit user intent to conclude detected. reason="${closureIntent.reason}" confidence=${closureIntent.confidence}`);

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
                        stopReason: closureIntent.reason
                    };
                } else {
                    nextState.phase = 'DATA_COLLECTION';
                    supervisorInsight = {
                        status: 'COMPLETE_WITHOUT_DATA',
                        stopReason: closureIntent.reason
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
                    effectiveSec
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
                console.log(`🎁 [DEEP_OFFER] State: deepAccepted=${state.deepAccepted} returnPhase=${state.extensionReturnPhase || 'DEEP'} attempts=${state.extensionOfferAttempts || 0}`);
                const deepOfferResult = await runDeepOfferPhase({
                    state: state as InterviewStateLike,
                    nextState: nextState as InterviewStateLike,
                    botTopics,
                    canonicalMessages,
                    lastUserMessage: lastMessage?.role === 'user' ? (lastMessage.content || '') : '',
                    shouldCollectData,
                    maxDurationMins,
                    effectiveSec,
                    deps: {
                        checkUserIntent: async (userMessage: string, context: 'deep_offer') =>
                            checkUserIntent(userMessage, openAIKey, language, context, { onUsage: collectLlmUsage }),
                        isExtensionOfferQuestion: (message: string) => isExtensionOfferQuestion(message, language),
                        buildDeepOfferInsight: (sourceState: InterviewStateLike) =>
                            buildDeepOfferInsight(sourceState as InterviewState),
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
                        getRemainingSubGoals: (topic: any, history?: Record<string, string[]>) => getRemainingSubGoals(topic, history),
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
                    effectiveSec
                });

                // Merge deepen result into nextState
                Object.assign(nextState, deepenResult.nextState);
                supervisorInsight = deepenResult.supervisorInsight;
                if (deepenResult.nextTopicId) {
                    nextTopicId = deepenResult.nextTopicId;
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
                        { simulationMode, onLlmUsage: collectLlmUsage, language }
                    );
                    supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                }

                if (state.dataCollectionRefused) {
                    await completeInterview(
                        conversationId,
                        canonicalMessages,
                        openAIKey,
                        conversation.candidateProfile || {},
                        { simulationMode, onLlmUsage: collectLlmUsage, language }
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
                        const intent = await checkUserIntent(
                            lastMessage?.content || '',
                            openAIKey,
                            language,
                            'consent',
                            { onUsage: collectLlmUsage }
                        );
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
                                { simulationMode, onLlmUsage: collectLlmUsage, language }
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

                        // CHECK (semantic): Did user change their mind mid-collection?
                        const midCollectionClosureIntent = lastMessage?.role === 'user'
                            ? await detectExplicitClosureIntent(lastMessage.content, openAIKey, language, { onUsage: collectLlmUsage })
                            : { wantsToConclude: false, confidence: 'low' as const, reason: 'no_user_message' };
                        const userWantsToStopMidCollection =
                            midCollectionClosureIntent.wantsToConclude && midCollectionClosureIntent.confidence !== 'low';

                        // CHECK: Is user frustrated/complaining about repeated questions?
                        const FRUSTRATION_IT = /\b(già (detto|chiesto)|te l'ho (già|appena)|incantato|bloccato|ripeti|sempre la stessa|loop)\b/i;
                        const FRUSTRATION_EN = /\b(already (told|said|asked)|just (told|said)|stuck|loop|same question|repeating)\b/i;
                        const frustrationPattern = language === 'it' ? FRUSTRATION_IT : FRUSTRATION_EN;
                        const userFrustrated = lastMessage?.role === 'user' && frustrationPattern.test(lastMessage.content);

                        if (userWantsToStopMidCollection) {
                            console.log(`📋 [DATA_COLLECTION] User wants to stop mid-collection (semantic). reason="${midCollectionClosureIntent.reason}" confidence=${midCollectionClosureIntent.confidence}`);
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode, onLlmUsage: collectLlmUsage, language }
                            );
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            nextState.dataCollectionRefused = true;
                            haltCollection = true;
                        }

                        // If user is frustrated about repeated questions, try to extract info from conversation history
                        // and complete the interview with what we have
                        if (userFrustrated) {
                            console.log(`⚠️ [DATA_COLLECTION] User frustrated - attempting to extract from history and complete`);

                            // Determine which name field is configured (name or fullName)
                            const configuredNameField = candidateFieldIds.find((fieldName: string) =>
                                fieldName === 'name' || fieldName === 'fullName'
                            );
                            const nameFieldKey = configuredNameField || 'fullName';

                            // Try to find the name in previous messages if we don't have it
                            if (!currentProfile[nameFieldKey]) {
                                // Look for a short reply (1-3 words) after a "name" question
                                for (let i = canonicalMessages.length - 1; i >= 0; i--) {
                                    const msg = canonicalMessages[i];
                                    if (msg.role === 'user') {
                                        const content = msg.content.trim();
                                        const words = content.split(/\s+/);
                                        // Short response that looks like a name
                                        if (words.length <= 3 && content.length < 30 && !/[@\d]/.test(content) && !isLikelyNonValueAck(content)) {
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

                            // Complete with what we have
                            await completeInterview(
                                conversationId,
                                canonicalMessages,
                                openAIKey,
                                currentProfile,
                                { simulationMode, onLlmUsage: collectLlmUsage, language }
                            );
                            supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
                            haltCollection = true;
                        }

                            if (!haltCollection) {
                            // CHECK: Did user say they don't have this field? ("non ho email", "I don't have")
                            const SKIP_FIELD_IT = /\b(non ho|non ce l'ho|non posso|preferisco non)\b/i;
                            const SKIP_FIELD_EN = /\b(i don't have|don't have|can't provide|prefer not to)\b/i;
                            const skipPattern = language === 'it' ? SKIP_FIELD_IT : SKIP_FIELD_EN;
                            const userWantsToSkip = lastMessage?.role === 'user' && skipPattern.test(lastMessage.content);

                            // Targeted extraction strategy:
                            // 1) prioritize the field we just asked,
                            // 2) opportunistically capture deterministic structured fields (email/phone/url),
                            // 3) avoid broad multi-field LLM extraction to reduce false positives.
                            if (lastMessage?.role === 'user' && !userWantsToSkip && !justAcceptedConsentThisTurn) {
                                const missingFieldIds = candidateFieldIds.filter((fieldName: string) =>
                                    !currentProfile[fieldName] && currentProfile[fieldName] !== '__SKIPPED__'
                                );
                                const lastAsked = state.lastAskedField;
                                const prioritizedField = (lastAsked && missingFieldIds.includes(lastAsked))
                                    ? lastAsked
                                    : (missingFieldIds[0] || null);

                                console.log(`📋 [DATA_COLLECTION] Missing fields: ${missingFieldIds.join(', ') || 'none'}`);
                                console.log(`📋 [DATA_COLLECTION] Prioritized field: ${prioritizedField || 'none'}`);

                                const userReply = lastMessage.content.trim();
                                const wordCount = userReply.split(/\s+/).length;
                                let profileChanged = false;

                                // Opportunistic deterministic extraction for structured fields present in free text.
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
                                    // Direct capture for NAME (1-3 words, no special chars)
                                    const isNameField = prioritizedField === 'fullName' || prioritizedField === 'name';
                                    const nameFieldKey = prioritizedField === 'name' ? 'name' : 'fullName';
                                    if (isNameField && wordCount <= 3 && !currentProfile[nameFieldKey] && !isLikelyNonValueAck(userReply)) {
                                        const cleanedName = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedName.length > 0 && cleanedName.length < 50 && !/[@\d]/.test(cleanedName)) {
                                            currentProfile = { ...currentProfile, [nameFieldKey]: cleanedName };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct name capture for "${nameFieldKey}"`);
                                        }
                                    }

                                    // Direct capture for COMPANY (1-5 words, reasonable length)
                                    if (prioritizedField === 'company' && wordCount <= 5 && !currentProfile.company && !isLikelyNonValueAck(userReply)) {
                                        const cleanedCompany = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedCompany.length > 1 && cleanedCompany.length < 100 &&
                                            !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedCompany)) {
                                            currentProfile = { ...currentProfile, company: cleanedCompany };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct company capture`);
                                        }
                                    }

                                    // Direct capture for ROLE (1-4 words)
                                    if (prioritizedField === 'role' && wordCount <= 4 && !currentProfile.role && !isLikelyNonValueAck(userReply)) {
                                        const cleanedRole = userReply.replace(/[.!?,;:]/g, '').trim();
                                        if (cleanedRole.length > 1 && cleanedRole.length < 50 &&
                                            !/^(no|non|basta|stop|te l'ho|l'ho già|già detto)/i.test(cleanedRole)) {
                                            currentProfile = { ...currentProfile, role: cleanedRole };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Direct role capture`);
                                        }
                                    }

                                    if (!currentProfile[prioritizedField]) {
                                        const deterministicValue = extractDeterministicFieldValue(prioritizedField, lastMessage.content);
                                        if (deterministicValue) {
                                            currentProfile = { ...currentProfile, [prioritizedField]: deterministicValue };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] Deterministic extraction for "${prioritizedField}"`);
                                        }
                                    }

                                    if (!currentProfile[prioritizedField]) {
                                        const extraction = await extractFieldFromMessage(
                                            prioritizedField,
                                            lastMessage.content,
                                            openAIKey,
                                            language,
                                            { onUsage: collectLlmUsage }
                                        );
                                        const attemptCount = (state.fieldAttemptCounts?.[prioritizedField] || 0) + 1;

                                        // Validate with structured feedback
                                        const validationResult = validateExtractedField(
                                            prioritizedField,
                                            extraction.value,
                                            extraction.confidence,
                                            attemptCount,
                                            language as 'it' | 'en'
                                        );

                                        console.log(`🔍 [DATA_COLLECTION] Extraction result for "${prioritizedField}": confidence="${extraction.confidence}" feedback="${validationResult.feedback}"`);

                                        if (validationResult.isValid) {
                                            currentProfile = { ...currentProfile, [prioritizedField]: extraction.value };
                                            profileChanged = true;
                                            console.log(`✅ [DATA_COLLECTION] LLM extraction for "${prioritizedField}"`);
                                        } else {
                                            console.log(`⚠️ [DATA_COLLECTION] Could not extract "${prioritizedField}": ${validationResult.reason}`);

                                            // Store validation feedback for supervisor/bot to use
                                            if (!supervisorInsight.validationFeedback) {
                                                supervisorInsight.validationFeedback = validationResult;
                                                supervisorInsight.feedbackMessage = validationResult.feedback;
                                            }
                                        }
                                    }
                                }

                                // Save only when profile changed in this turn.
                                if (profileChanged) {
                                    await prisma.conversation.update({
                                        where: { id: conversationId },
                                        data: { candidateProfile: currentProfile }
                                    });
                                    console.log(`✅ [DATA_COLLECTION] Saved profile`);
                                }
                            } else if (justAcceptedConsentThisTurn) {
                                console.log(`📋 [DATA_COLLECTION] Consent just accepted: skip extraction this turn and ask first missing field.`);
                            } else if (userWantsToSkip && state.lastAskedField) {
                                // User wants to skip this field - mark it as skipped so we don't ask again
                                console.log(`📋 [DATA_COLLECTION] User wants to skip "${state.lastAskedField}"`);
                                currentProfile = { ...currentProfile, [state.lastAskedField]: '__SKIPPED__' };
                                await prisma.conversation.update({
                                    where: { id: conversationId },
                                    data: { candidateProfile: currentProfile }
                                });
                            }

                            // Find next missing field (skip fields marked as __SKIPPED__ or asked too many times)
                            const MAX_FIELD_ATTEMPTS = 3; // Skip field if asked more than 3 times
                            const nextField = getNextMissingCandidateField(
                                candidateFieldIds,
                                currentProfile,
                                state.fieldAttemptCounts,
                                MAX_FIELD_ATTEMPTS
                            );
                            console.log(`📋 [DATA_COLLECTION] Next field to ask: ${nextField || 'NONE - all collected/skipped'}`);

                            if (!nextField) {
                                // All fields collected or skipped!
                                console.log(`✅ [DATA_COLLECTION] All fields collected/skipped, letting AI say final goodbye`);
                                supervisorInsight = { status: 'FINAL_GOODBYE' };
                                nextState.lastAskedField = null;
                            } else {
                                // Set up to ask next field - track attempt count
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
        console.log(`📊 [SUPERVISOR] Insight: ${supervisorInsight?.status || 'N/A'}, NextSubGoal: ${supervisorInsight?.nextSubGoal || 'N/A'}`);
        console.log(`🧭 [FLOW] Phase Transition: ${state.phase} -> ${nextState.phase}`);
        if (state.topicIndex !== nextState.topicIndex) {
            console.log(`🔄 [TOPIC] Pivot: Topic Index ${state.topicIndex} -> ${nextState.topicIndex}`);
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
        console.log("🧠 [MODEL_ROUTING]", modelRegistry.names);
        const nextActiveTopics = nextState.phase === 'DEEPEN'
            ? getDeepTopics(botTopics, nextState.deepTopicOrder || state.deepTopicOrder)
            : botTopics;
        const targetTopic = nextActiveTopics[nextState.topicIndex] || currentTopic;
        const runtimeInterviewKnowledge = await runtimeInterviewKnowledgePromise;
        if (runtimeInterviewKnowledge) {
            nextState.runtimeInterviewKnowledge = runtimeInterviewKnowledge;
            nextState.runtimeInterviewKnowledgeSignature = runtimeKnowledgeSignature;
        } else if (!manualInterviewGuide && !hasValidRuntimeKnowledge) {
            nextState.runtimeInterviewKnowledge = null;
            nextState.runtimeInterviewKnowledgeSignature = null;
        }
        const userTurnSignal: UserTurnSignal = lastMessage?.role === 'user'
            ? detectUserTurnSignal({
                userMessage: lastMessage.content,
                language,
                phase: nextState.phase,
                currentTopic,
                targetTopic,
                interviewObjective
            })
            : 'none';
        const previousAssistantQuestion = extractLastAssistantQuestion(previousAssistantMessage);
        const recentBridgeStems = collectRecentBridgeStems(canonicalMessages, 14);
        const plannerTopic = targetTopic || currentTopic;
        const plannerTopicId = plannerTopic?.id || currentTopic.id;
        const plannerMaxTurns = nextState.phase === 'DEEPEN'
            ? getDeepPlanTurns(interviewPlan, plannerTopicId)
            : getScanPlanTurns(interviewPlan, plannerTopicId);
        const plannerUsedSubGoals = (nextState.topicSubGoalHistory || {})[plannerTopicId] || [];
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
            runtimeKnowledge: runtimeInterviewKnowledge || state.runtimeInterviewKnowledge || null
        });


        systemPrompt = await PromptBuilder.build(
            bot,
            conversation,
            currentTopic,
            effectiveSec,
            supervisorInsight,
            interviewPlan,
            manualInterviewGuide || undefined
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
                const toneProfile = await toneAnalyzer.analyzeTone(canonicalMessages, language);
                const toneBlock = buildToneAdaptationPrompt(toneProfile, language);
                if (toneBlock) {
                    systemPrompt += `\n\n${toneBlock}`;
                }
            } catch (toneErr) {
                // Non-blocking: tone adaptation is best-effort, never fails the main request
                console.error('[TONE] Analysis failed (non-blocking):', toneErr);
            }
        }

        console.log("📝 [PROMPT_BUILDER] System Prompt length:", systemPrompt.length);
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
            ['EXPLORING', 'DEEPENING', 'TRANSITION', 'START_DEEP', 'START_DEEP_BRIEF'].includes(supervisorInsight?.status);

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
        if (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') {
            const microPlannerPrompt = buildMicroPlannerPromptBlock({
                language,
                phase: nextState.phase,
                topicLabel: plannerTopic?.label || currentTopic.label,
                decision: microPlannerDecision
            });
            if (microPlannerPrompt) {
                systemPrompt += `\n\n${microPlannerPrompt}`;
            }
            console.log("🧭 [MICRO_PLANNER]", {
                mode: microPlannerDecision.mode,
                commentStyle: microPlannerDecision.commentStyle,
                focusSubGoal: microPlannerDecision.focusSubGoal,
                signalScore: Number(microPlannerDecision.signalScore.toFixed(2)),
                coverage: microPlannerDecision.topicCoverage,
                knowledgeSource: microPlannerDecision.knowledgeSource
            });
        }

        if (userTurnSignal === 'clarification') {
            systemPrompt += language === 'it'
                ? `\n\n## CLARIFICATION GUARD (OBBLIGATORIO)\nL'utente sta chiedendo un chiarimento: NON ignorarlo.\n1) Rispondi gentilmente chiarendo in modo diretto la domanda precedente, senza formule vaghe.\n2) Se l'utente mette due opzioni (es. "X o Y"), specifica chiaramente quale intendevi.\n3) Dopo il chiarimento, fai UNA sola domanda di follow-up coerente con il topic corrente.`
                : `\n\n## CLARIFICATION GUARD (MANDATORY)\nThe user is asking for clarification: do NOT ignore it.\n1) Reply kindly by directly clarifying your previous question.\n2) If the user offers two options (e.g. "X or Y"), state clearly which one you meant.\n3) After clarifying, ask ONE coherent follow-up question on the current topic.`;
        } else if (userTurnSignal === 'off_topic_question') {
            systemPrompt += language === 'it'
                ? `\n\n## SCOPE GUARD (OBBLIGATORIO)\nL'utente ha fatto una domanda fuori dallo scopo dell'intervista.\n1) Rispondi con una frase gentile che spieghi che la domanda esula dallo scopo di questa intervista.\n2) Riporta subito il focus al topic corrente con UNA sola domanda mirata.\n3) Non sviluppare il tema fuori scopo in dettaglio.`
                : `\n\n## SCOPE GUARD (MANDATORY)\nThe user asked a question outside the interview scope.\n1) Reply with one polite sentence stating that the question is outside the scope of this interview.\n2) Immediately redirect to the current topic with ONE focused question.\n3) Do not expand on the off-topic question.`;
        }

        const shouldEndWithQuestion = !['COMPLETE_WITHOUT_DATA', 'FINAL_GOODBYE'].includes(supervisorInsight?.status);
        if (shouldEndWithQuestion) {
            systemPrompt += (language || '').toLowerCase().startsWith('it')
                ? `\n\n## OBBLIGATORIO: La risposta deve terminare con un punto interrogativo (?).`
                : `\n\n## MANDATORY: Your response MUST end with a question mark (?).`;
        }

        // ====================================================================
        // 5. GENERATE RESPONSE
        // ====================================================================
        const schema = z.object({
            response: z.string().describe("The conversational response to the user."),
            meta_comment: z.string().optional()
        });

        let messagesForAI = canonicalMessages.map((m: any) => ({ role: m.role, content: m.content }));
        if (supervisorInsight?.status === 'DATA_COLLECTION_CONSENT' || supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            // Keep recent messages for context so the LLM can preserve continuity in sensitive transitions.
            const recentMessages = canonicalMessages.slice(-6).map((m: any) => ({ role: m.role, content: m.content }));
            messagesForAI = recentMessages;
        }

        const criticalTurnRouting = shouldUseCriticalModelForTopicTurn({
            phase: nextState.phase,
            supervisorStatus: supervisorInsight?.status,
            userTurnSignal,
            userMessage: lastMessage?.role === 'user' ? lastMessage.content : '',
            language
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

        console.log("⏳ [CHAT] Generating response...");
        console.time("LLM");

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

        let result: any;
        try {
            result = await Promise.race([
                trackedGenerateObject({ model: modelForMainResponse, schema, messages: messagesForAI, system: contextWithFeedback, temperature: 0.7 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 45000))
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
                return Response.json({ text: fallback, currentTopicId: nextTopicId, isCompleted: false });
            }
            const errorName = String(error?.name || '');
            const errorMessage = String(error?.message || '');
            const isObjectValidationFailure =
                errorName.includes('AI_NoObjectGeneratedError') ||
                errorMessage.includes('No object generated') ||
                errorMessage.includes('did not match schema');
            if (isObjectValidationFailure) {
                console.error('⚠️ [LLM] Object schema validation failed. Retrying with fallback strategy.', {
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
                    console.error('⚠️ [LLM] Minimal-schema retry failed. Falling back to generateText.', innerError);
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

        console.timeEnd("LLM");
        let responseText = result.object.response;
        console.log(`🧠 [LLM_REASONING]: ${result.object.meta_comment || 'N/A'}`);
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
            ? supervisorInsight.extensionPreview.map(v => String(v || '').trim()).filter(Boolean).slice(0, 1)
            : [];
        const userBridgeHint = lastMessage?.role === 'user'
            ? buildUserBridgeHint(lastMessage.content, language)
            : '';

        if (supervisorInsight?.status === 'DEEP_OFFER_ASK') {
            if (!isExtensionOfferQuestion(responseText, language)) {
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
            if (!isExtensionOfferQuestion(responseText, language)) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    onUsage: collectLlmUsage
                });
                didRegenerate = true;
            }
        }

        // Clarification/scope enforcement on topic phases:
        // if the user asked a clarification or an off-topic question,
        // ensure the assistant acknowledges it explicitly before continuing.
        if (nonHardSafetyRegenerationsEnabled && !didRegenerate && (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN') && lastMessage?.role === 'user') {
            if (userTurnSignal === 'clarification' && !isClarificationHandledResponse(responseText, language)) {
                console.log(`⚠️ [SUPERVISOR] Clarification requested but not handled clearly. Regenerating.`);
                const enforcedSystem = language === 'it'
                    ? `${systemPrompt}\n\nCRITICAL: Rispondi prima al chiarimento in modo diretto e gentile (specifica esattamente cosa intendevi), poi fai UNA sola domanda coerente col topic corrente.`
                    : `${systemPrompt}\n\nCRITICAL: First answer the clarification directly and kindly (state exactly what you meant), then ask ONE coherent follow-up question on the current topic.`;
                const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.25 });
                responseText = retry.object.response?.trim() || responseText;
                didRegenerate = true;
            } else if (userTurnSignal === 'off_topic_question' && !isScopeBoundaryHandledResponse(responseText, language)) {
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
                        requireAcknowledgment: true,
                        transitionMode: supervisorInsight?.transitionMode,
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
        const GOODBYE_PATTERNS_IT = /\b(arrivederci|buona giornata|buona serata|a presto|ci sentiamo|grazie per il tuo tempo|è stato un piacere|ti auguro|in bocca al lupo|ti contatteremo|ti terremo aggiornato)\b/i;
        const GOODBYE_PATTERNS_EN = /\b(goodbye|see you|take care|have a great day|it was a pleasure|best wishes|all the best|farewell|we will contact you|we'll be in touch)\b/i;
        const goodbyePattern = language === 'it' ? GOODBYE_PATTERNS_IT : GOODBYE_PATTERNS_EN;

        // Vague data collection patterns - bot is not asking for specific field
        const VAGUE_DATA_PATTERNS_IT = /\b(quali contatti|che tipo di dati|le informazioni che preferisci|condividi.*contatti|c'è qualcos'altro|qualcos'altro da aggiungere|altri temi|altre domande|vuoi aggiungere)\b/i;
        const VAGUE_DATA_PATTERNS_EN = /\b(which contact|what type of data|information you prefer|share.*contact|anything else|something to add|other topics|other questions|want to add)\b/i;
        const vagueDataPattern = language === 'it' ? VAGUE_DATA_PATTERNS_IT : VAGUE_DATA_PATTERNS_EN;

        const isGoodbyeResponse = goodbyePattern.test(responseText);
        const isVagueDataRequest = vagueDataPattern.test(responseText);
        const hasNoQuestion = !responseText.includes('?');
        const hasCompletionTag = /INTERVIEW_COMPLETED/i.test(responseText);

        // CRITICAL: Detect "goodbye with question" pattern (e.g., "Buona giornata! Ci vediamo?")
        // This is a closure attempt disguised as a question
        const isGoodbyeWithQuestion = isGoodbyeResponse && responseText.includes('?');
        if (isGoodbyeWithQuestion) {
            console.log(`⚠️ [SUPERVISOR] Detected goodbye phrase WITH question mark - treating as closure attempt`);
        }

        // CRITICAL: Detect premature contact requests (bot asking for contacts during SCAN/DEEP)
        const CONTACT_REQUEST_PATTERNS_IT = /\b(posso chiederti i tuoi contatti|i tuoi dati di contatto|la tua email|il tuo numero|come ti chiami|qual è la tua email|prima di salutarci|prima di concludere.*contatt)/i;
        const CONTACT_REQUEST_PATTERNS_EN = /\b(may i ask for your contact|your contact details|your email|your phone|what is your name|before we say goodbye.*contact|before we wrap up.*contact)/i;
        const contactRequestPattern = language === 'it' ? CONTACT_REQUEST_PATTERNS_IT : CONTACT_REQUEST_PATTERNS_EN;
        const isPrematureContactRequest = contactRequestPattern.test(responseText) && nextState.phase !== 'DATA_COLLECTION';
        if (isPrematureContactRequest) {
            console.log(`⚠️ [SUPERVISOR] Bot tried to ask for contacts during ${nextState.phase} phase - intercepting!`);
        }

        console.log("🔎 [SUPERVISOR] Flags:", {
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

        const PROMO_PATTERNS = /\b(www\.|https?:\/\/|@|email|scrivi a|contatta|offerta|promo|premio|reward|coupon|sconto)\b/i;
        const isPromoContent = PROMO_PATTERNS.test(responseText) && (nextState.phase === 'EXPLORE' || nextState.phase === 'DEEPEN' || nextState.phase === 'DEEP_OFFER');
        if (isPromoContent) {
            console.log(`⚠️ [SUPERVISOR] Promo/CTA detected during active phase. Regenerating.`);
            const enforceTopic = targetTopic?.label || currentTopic.label;
            const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Remove any promo/CTA. Ask exactly ONE question about "${enforceTopic}".`;
            const retry = await trackedGenerateObject({ model: criticalModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.3 });
            responseText = retry.object.response?.trim() || responseText;
        }

        // Supervisor logic (no hardcoded overrides to respect AI reasoning)

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
                const freshConversation = await prisma.conversation.findUnique({
                    where: { id: conversationId },
                    select: { candidateProfile: true }
                });
                const currentProfile = (freshConversation?.candidateProfile as any) || {};

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
                    const openai = createOpenAI({ apiKey: openAIKey });
                    const consentSchema = z.object({ isConsent: z.boolean() });
                    let isConsent = false;
                    try {
                        const consentCheck = await trackedGenerateObject({
                            model: openai('gpt-4o-mini'),
                            schema: consentSchema,
                            prompt: `Determine if the assistant is explicitly asking for permission to collect contact details and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isConsent: true/false }.`,
                            temperature: 0
                        });
                        isConsent = consentCheck.object.isConsent;
                    } catch (e) {
                        console.error('Consent validation failed:', e);
                    }

                    if (!isConsent || forceConsent) {
                        console.log(`⚠️ [SUPERVISOR] Bot gave wrong response during DATA_COLLECTION consent. OVERRIDING with consent question.`);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Start with one short linking sentence acknowledging the content interview is complete, then ask ONLY one yes/no consent question to collect contact details. Do not ask topic questions.`;
                        const retry = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem, temperature: 0.2 });
                        responseText = retry.object.response?.trim() || responseText;

                        try {
                            const consentCheck2 = await trackedGenerateObject({
                                model: openai('gpt-4o-mini'),
                                schema: consentSchema,
                                prompt: `Determine if the assistant is explicitly asking for permission to collect contact details and waiting for yes/no.\nAssistant message: "${responseText}"\nReturn { isConsent: true/false }.`,
                                temperature: 0
                            });
                            if (!consentCheck2.object.isConsent) {
                                const enforcedSystem2 = `Write one short linking sentence acknowledging interview closure, then ask a single yes/no question asking permission to collect contact details.`;
                                const retry2 = await trackedGenerateObject({ model: dataCollectionModel, schema, messages: messagesForAI, system: enforcedSystem2, temperature: 0.1 });
                                responseText = retry2.object.response?.trim() || responseText;
                            }
                        } catch (e) {
                            console.error('Consent validation retry failed:', e);
                        }
                    }
                    if (forceConsent) {
                        nextState.forceConsentQuestion = false;
                    }
                }
                // FIELD COLLECTION PHASE: bot should ask for specific field
                else if (nextState.consentGiven === true && missingField) {
                    // Only override if the response doesn't already ask for this field
                    const fieldMentioned = responseMentionsCandidateField(responseText, missingField);

                    if (!fieldMentioned || hasNoQuestion) {
                        console.log(`⚠️ [SUPERVISOR] Bot not asking for specific field "${missingField}". OVERRIDING with field question.`);
                        const fieldLabel = getFieldLabel(missingField, language);
                        const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Ask ONLY for ${fieldLabel}. One question only.`;
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
                const returnPhase: 'SCAN' | 'DEEP' = state.phase === 'EXPLORE' ? 'SCAN' : 'DEEP';
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
                const stillBad = !responseText.includes('?') || goodbyePattern.test(responseText);
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
                            requireAcknowledgment: true,
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
            if (!isExtensionOfferQuestion(responseText, language)) {
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
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
                !isExtensionOfferQuestion(responseText, language) ||
                goodbyePattern.test(responseText) ||
                /INTERVIEW_COMPLETED/i.test(responseText);
            if (invalidDeepOffer) {
                flowTelemetry.deepOfferClosureIntercepted = true;
                console.log(`🛡️ [SAFETY_NET] Invalid DEEP_OFFER response, fixing...`);
                responseText = await enforceDeepOfferQuestion({
                    model: criticalModel,
                    language,
                    currentText: responseText,
                    extensionPreview: deepOfferPreviewHints,
                    onUsage: collectLlmUsage
                });
            }
        }

        // Final fail-safe for DATA_COLLECTION:
        // keep phase-consistent behavior even when previous regenerations drift.
        if (nextState.phase === 'DATA_COLLECTION' && !nextState.dataCollectionRefused && supervisorInsight?.status !== 'COMPLETE_WITHOUT_DATA') {
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const freshConvForDataGuard = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfileForDataGuard = (freshConvForDataGuard?.candidateProfile as any) || {};
            const missingFieldForDataGuard = getNextMissingCandidateField(
                candidateFieldIds,
                currentProfileForDataGuard,
                nextState.fieldAttemptCounts,
                3
            );

            const needsConsentQuestion = nextState.forceConsentQuestion === true || nextState.consentGiven === false;
            const hasQuestionNow = responseText.includes('?');
            const hasCompletionTagNow = /INTERVIEW_COMPLETED/i.test(responseText);
            const hasGoodbyeNow = goodbyePattern.test(responseText);

            if (needsConsentQuestion) {
                const consentCuePattern = language === 'it'
                    ? /\b(posso|permesso|consenso|contatt|restare in contatto)\b/i
                    : /\b(may i|permission|consent|contact|stay in touch)\b/i;
                const invalidConsentResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !consentCuePattern.test(responseText);
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
                const fieldMentioned = responseMentionsCandidateField(responseText, missingFieldForDataGuard);
                const invalidFieldResponse =
                    !hasQuestionNow ||
                    hasCompletionTagNow ||
                    hasGoodbyeNow ||
                    !fieldMentioned;
                if (invalidFieldResponse) {
                    console.log(`🛡️ [FINAL_GUARD] DATA_COLLECTION field response invalid for "${missingFieldForDataGuard}". Forcing field question.`);
                    const fieldLabel = getFieldLabel(missingFieldForDataGuard, language);
                    try {
                        responseText = await generateFieldQuestionOnly({
                            model: dataCollectionModel,
                            language,
                            fieldLabel,
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

        const buildAssistantMetadata = (isCompletion: boolean = false): Prisma.InputJsonObject => {
            return {
                ...(clientMessageId ? { replyToClientMessageId: clientMessageId } : {}),
                phase: nextState.phase,
                supervisorStatus: supervisorInsight?.status ?? null,
                reasoning: result?.object?.meta_comment ?? null,
                topicLabel: targetTopic?.label || currentTopic.label,
                topicId: targetTopic?.id || currentTopic.id,
                quality: qualityTelemetry as unknown as Prisma.InputJsonValue,
                flowFlags: flowTelemetry as unknown as Prisma.InputJsonValue,
                llmUsage: getLlmUsageSnapshot() as unknown as Prisma.InputJsonValue,
                responseLatencyMs: Date.now() - startTime,
                simulationMode,
                abVariant,
                ...(isCompletion ? { isCompletion: true } : {})
            };
        };

        // Check for completion tag - only valid if we're actually done
        if (/INTERVIEW_COMPLETED/i.test(responseText)) {
            // Verify we're actually done - MUST re-read from DB for fresh data
            const candidateFields = (bot.candidateDataFields as any[]) || [];
            const candidateFieldIds = normalizeCandidateFieldIds(candidateFields);
            const freshConvForCompletion = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { candidateProfile: true }
            });
            const currentProfileForCompletion = (freshConvForCompletion?.candidateProfile as any) || {};
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
                // Guardrail: consent granted but fields still missing -> ask the specific field, not completion.
                const fieldLabel = getFieldLabel(missingFieldForCompletion, language);
                console.log(`⚠️ [SUPERVISOR] Bot said INTERVIEW_COMPLETED but "${missingFieldForCompletion}" is still missing. OVERRIDING with field question.`);
                const enforcedSystem = `${systemPrompt}\n\nCRITICAL: Do NOT conclude. Ask ONLY for ${fieldLabel}. One question only.`;
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
                    { simulationMode, onLlmUsage: collectLlmUsage, language }
                );
                const finalResponseText = responseText.replace(/INTERVIEW_COMPLETED/gi, '').trim();
                await prisma.message.create({
                    data: {
                        conversationId,
                        role: 'assistant',
                        content: finalResponseText,
                        metadata: buildAssistantMetadata(true)
                    }
                });
                await flushInterviewTokenUsage('completed_response');
                return Response.json({
                    text: finalResponseText,
                    currentTopicId: nextTopicId,
                    isCompleted: true
                });
            }
        }

        // ====================================================================
        // 6. SAVE & UPDATE STATE (parallelized for speed)
        // ====================================================================
        // Run save operations in parallel - they're independent
        await Promise.all([
            // Save assistant message
            prisma.message.create({
                data: {
                    conversationId,
                    role: 'assistant',
                    content: responseText,
                    metadata: buildAssistantMetadata(false)
                }
            }),
            // Update conversation state (metadata + topic in one query)
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    metadata: nextState as any,
                    currentTopicId: nextTopicId
                }
            })
        ]);

        const totalTime = Date.now() - startTime;
        console.log(`✅ [CHAT_API] Finished. Response sent. Next Phase: ${nextState.phase}`);
        console.log(`⏱️ [TIMING] TOTAL REQUEST: ${totalTime}ms`);

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

        await flushInterviewTokenUsage('standard_response');
        return Response.json({
            text: responseText,
            currentTopicId: nextTopicId,
            isCompleted: false
        });

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
                error: String(error?.message || 'unknown_error')
            },
            { status: 200 }
        );
    }
}
