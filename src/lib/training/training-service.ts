// src/lib/training/training-service.ts
import { generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { TokenTrackingService } from '@/services/tokenTrackingService'
import { LLMService } from '@/services/llmService'
import { getDefaultTrainingMethodologyKnowledge, getTrainingMethodologyKnowledgeByOrg } from '@/lib/training/training-methodology-kb'
import {
  buildExplainingPrompt,
  buildQuizzingSystemPrompt,
  buildRetryingPrompt,
  buildFinalFeedbackPrompt,
  buildDialoguePrompt,
  buildFinalQuizSystemPrompt,
} from './training-prompts'
import {
  buildInitialState,
  advanceAfterEvaluation,
  advanceDialogueTopic,
  computeOverallScore,
  computeSessionPassed,
} from './training-supervisor'
import { evaluateOpenAnswer, evaluateQuizAnswers, computeTopicScore, detectCompetenceLevel } from './training-evaluator'
import type { TrainingSupervisorState, TrainingChatResponse, TopicResult, QuizQuestion, ComprehensionEntry, DialogueTopicResult } from './training-types'
import type { TrainingPhase } from '@prisma/client'

let trainingPhaseEnumEnsured = false
let trainingTopicColumnsEnsured = false
let trainingKnowledgeSchemaEnsured = false
const methodologyByOrgCache = new Map<string, { value: string; expiresAt: number }>()
const METHODOLOGY_CACHE_TTL_MS = 5 * 60 * 1000
const VALID_TRAINING_PHASES: TrainingPhase[] = [
  'EXPLAINING',
  'CHECKING',
  'QUIZZING',
  'EVALUATING',
  'RETRYING',
  'DATA_COLLECTION',
  'DIALOGUING',
  'FINAL_QUIZZING',
  'COMPLETE',
]

async function getTrainingGlobalMethodology(organizationId: string): Promise<string> {
  const now = Date.now()
  const cached = methodologyByOrgCache.get(organizationId)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  let value = ''
  try {
    const row = await getTrainingMethodologyKnowledgeByOrg(organizationId)
    value = String(row.knowledge || '').trim()
  } catch {
    value = ''
  }

  if (!value) {
    value = getDefaultTrainingMethodologyKnowledge()
  }

  methodologyByOrgCache.set(organizationId, {
    value,
    expiresAt: now + METHODOLOGY_CACHE_TTL_MS,
  })

  return value
}

async function ensureTrainingPhaseEnumCompatibility() {
  if (trainingPhaseEnumEnsured) return

  for (const phase of VALID_TRAINING_PHASES) {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TYPE "TrainingPhase" ADD VALUE IF NOT EXISTS '${phase}';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
  }

  trainingPhaseEnumEnsured = true
}

async function ensureTrainingTopicDialogueColumns() {
  if (trainingTopicColumnsEnsured) return
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "TrainingTopicBlock"
      ADD COLUMN IF NOT EXISTS "minCheckingTurns" INTEGER NOT NULL DEFAULT 2,
      ADD COLUMN IF NOT EXISTS "maxCheckingTurns" INTEGER NOT NULL DEFAULT 6;
  `)
  trainingTopicColumnsEnsured = true
}

async function ensureTrainingKnowledgeSchemaCompatibility() {
  if (trainingKnowledgeSchemaEnsured) return
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeSource"
      ADD COLUMN IF NOT EXISTS "trainingBotId" TEXT;
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "KnowledgeSource"
      ALTER COLUMN "botId" DROP NOT NULL;
  `)
  trainingKnowledgeSchemaEnsured = true
}

function normalizeTrainingPhase(value: string | null | undefined): TrainingPhase {
  if (value && VALID_TRAINING_PHASES.includes(value as TrainingPhase)) {
    return value as TrainingPhase
  }
  return 'EXPLAINING'
}

async function logTrainingTokens(
  organizationId: string,
  modelName: string,
  usage: { inputTokens: number | undefined; outputTokens: number | undefined } | undefined,
  operation: string
): Promise<void> {
  if (!usage) return
  try {
    await TokenTrackingService.logTokenUsage({
      organizationId,
      userId: undefined,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      category: 'TRAINING',
      model: modelName,
      operation,
      resourceType: 'training',
    })
  } catch (err) {
    console.error('[Training] Token logging failed:', err)
  }
}

function getModel(
  provider: string,
  name: string,
  keys: { botOpenAIKey?: string | null; globalOpenAIKey?: string | null; globalAnthropicKey?: string | null }
) {
  if (provider === 'anthropic') {
    const anthropicKey = (keys.globalAnthropicKey || process.env.ANTHROPIC_API_KEY || '').trim()
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY_MISSING')
    }
    return createAnthropic({ apiKey: anthropicKey })(name)
  }
  const openaiKey = (keys.botOpenAIKey || keys.globalOpenAIKey || process.env.OPENAI_API_KEY || '').trim()
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY_MISSING')
  }
  return createOpenAI({ apiKey: openaiKey })(name)
}

function stripTopicTransitionFromTutorText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\b(?:bene|ottimo|perfetto)[^.!?]{0,80}passiamo al prossimo argomento[^.!?]*[.!?]?/gi, '')
    .replace(/\b(?:great|perfect)[^.!?]{0,80}let'?s move to the next topic[^.!?]*[.!?]?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeFinalQuizQuestions(rawQuestions: QuizQuestion[], language = 'it'): QuizQuestion[] {
  const tfFallback = language === 'it' ? ['Vero', 'Falso'] : ['True', 'False']
  const openFallbackPoint =
    language === 'it'
      ? 'Risposta coerente con i concetti chiave del topic.'
      : 'Answer aligned with the topic key concepts.'

  const normalized = rawQuestions
    .map((q, index) => {
      const id = (q.id || `q${index + 1}`).trim() || `q${index + 1}`
      const question = (q.question || '').trim()
      if (!question) return null

      if (q.type === 'OPEN_ANSWER') {
        const expectedKeyPoints = Array.isArray(q.expectedKeyPoints) && q.expectedKeyPoints.length > 0
          ? q.expectedKeyPoints
          : [openFallbackPoint]
        return { id, type: 'OPEN_ANSWER', question, expectedKeyPoints } satisfies QuizQuestion
      }

      if (q.type === 'TRUE_FALSE') {
        const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 2) : tfFallback
        const correctIndex =
          typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < options.length
            ? q.correctIndex
            : 0
        return { id, type: 'TRUE_FALSE', question, options, correctIndex } satisfies QuizQuestion
      }

      const options = Array.isArray(q.options)
        ? q.options.map((opt) => String(opt).trim()).filter(Boolean)
        : []
      if (options.length < 2) {
        return {
          id,
          type: 'OPEN_ANSWER',
          question,
          expectedKeyPoints: Array.isArray(q.expectedKeyPoints) && q.expectedKeyPoints.length > 0
            ? q.expectedKeyPoints
            : [openFallbackPoint],
        } satisfies QuizQuestion
      }
      const correctIndex =
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < options.length
          ? q.correctIndex
          : 0
      return { id, type: 'MULTIPLE_CHOICE', question, options, correctIndex } satisfies QuizQuestion
    })
    .filter((q): q is QuizQuestion => q !== null)

  if (normalized.length > 0) return normalized

  return [{
    id: 'q1',
    type: 'OPEN_ANSWER',
    question: language === 'it'
      ? 'Riassumi in 4-5 righe i concetti principali appresi durante il percorso.'
      : 'Summarize in 4-5 lines the main concepts learned during the training.',
    expectedKeyPoints: [openFallbackPoint],
  }]
}

const DEFAULT_CALIBRATION_QUESTIONS_IT = [
  'Per personalizzare la lezione: qual è il tuo ruolo e in quale contesto userai questo argomento?',
  'Che livello senti di avere oggi su questo tema? (base, intermedio, avanzato) + un esempio rapido.',
  'Quale risultato pratico vuoi ottenere entro fine lezione? Così userò esempi pertinenti.',
]

function getCalibrationQuestions(bot: { collectTraineeData: boolean; traineeDataFields: unknown }): string[] {
  if (!bot.collectTraineeData) return []
  if (Array.isArray(bot.traineeDataFields)) {
    const custom = bot.traineeDataFields
      .map((q) => (typeof q === 'string' ? q.trim() : ''))
      .filter(Boolean)
      .slice(0, 5)
    if (custom.length > 0) return custom
  }
  return DEFAULT_CALIBRATION_QUESTIONS_IT
}

function inferCompetenceFromCollectedAnswers(collected: Record<string, string>): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  const text = Object.values(collected).join(' ').toLowerCase()
  if (/\b(base|principiante|beginner|zero|nessuna esperienza|novizio)\b/.test(text)) return 'BEGINNER'
  if (/\b(avanzat|expert|esperto|senior|molta esperienza)\b/.test(text)) return 'ADVANCED'
  return 'INTERMEDIATE'
}

function buildLearnerProfileSummary(collected?: Record<string, string>): string | undefined {
  if (!collected) return undefined
  const role = collected.roleContext?.trim()
  const level = collected.selfLevel?.trim()
  const goal = collected.practicalGoal?.trim()
  const parts = [
    role ? `Ruolo/contesto: ${role}` : '',
    level ? `Autovalutazione livello: ${level}` : '',
    goal ? `Obiettivo pratico: ${goal}` : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('\n') : undefined
}

export async function processTrainingMessage(
  sessionId: string,
  userMessage: string
): Promise<TrainingChatResponse> {
  await ensureTrainingPhaseEnumCompatibility()
  await ensureTrainingTopicDialogueColumns()
  await ensureTrainingKnowledgeSchemaCompatibility()

  // 1. Load session + bot
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      trainingBot: {
        include: { topics: { orderBy: { orderIndex: 'asc' } }, knowledgeSources: true },
      },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  const bot = session.trainingBot
  const topics = bot.topics
  const state: TrainingSupervisorState = (session.supervisorState as unknown as TrainingSupervisorState) ?? buildInitialState()
  const calibrationQuestions = getCalibrationQuestions({
    collectTraineeData: bot.collectTraineeData,
    traineeDataFields: bot.traineeDataFields,
  })
  const learnerProfile = buildLearnerProfileSummary(state.dataCollected)

  const globalConfig = await LLMService.getGlobalConfig()

  if (state.phase === 'COMPLETE') {
    return { text: 'Il percorso formativo è già completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const currentTopic = topics[state.currentTopicIndex]
  if (!currentTopic) {
    return { text: 'Percorso completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const model = getModel(bot.modelProvider, bot.modelName, {
    botOpenAIKey: bot.customApiKey,
    globalOpenAIKey: globalConfig?.openaiApiKey,
    globalAnthropicKey: globalConfig?.anthropicApiKey,
  })

  const globalMethodology = await getTrainingGlobalMethodology(bot.organizationId)
  const botKnowledge = bot.knowledgeSources.length > 0
    ? bot.knowledgeSources.map((s) => `## ${s.title ?? 'Fonte'}\n${s.content}`).join('\n\n---\n\n')
    : ''

  // Global didactic framework is always included first, then bot-specific materials.
  const kbChunks = [
    globalMethodology ? `## Framework didattico globale\n${globalMethodology}` : '',
    botKnowledge,
  ].filter(Boolean)

  const kbContent = kbChunks.length > 0
    ? kbChunks.join('\n\n---\n\n').slice(0, 16_000)
    : undefined

  // 2. Save user message
  await prisma.trainingMessage.create({
    data: {
      trainingSessionId: sessionId,
      role: 'user',
      phase: normalizeTrainingPhase(state.phase),
      content: userMessage,
    },
  })

  // 3. Handle phase
  let response: TrainingChatResponse

  switch (state.phase) {
    case 'DATA_COLLECTION': {
      if (calibrationQuestions.length === 0) {
        const nextState: TrainingSupervisorState = {
          ...state,
          phase: 'EXPLAINING',
          dataCollectionPhase: 'DONE',
          dataCollectionStep: undefined,
          dataCollected: undefined,
        }
        await saveStateAndMessage(sessionId, nextState, bot.language === 'it' ? 'Iniziamo dal primo argomento.' : 'Let us start with the first topic.', 'DATA_COLLECTION')
        response = { text: bot.language === 'it' ? 'Iniziamo dal primo argomento.' : 'Let us start with the first topic.', phase: 'EXPLAINING' }
        break
      }

      const currentStep = Math.max(0, Math.min(state.dataCollectionStep ?? 0, calibrationQuestions.length - 1))
      const collected = { ...(state.dataCollected ?? {}) }

      if (currentStep === 0) collected.roleContext = userMessage.trim()
      if (currentStep === 1) collected.selfLevel = userMessage.trim()
      if (currentStep === 2) collected.practicalGoal = userMessage.trim()

      if (currentStep < calibrationQuestions.length - 1) {
        const nextState: TrainingSupervisorState = {
          ...state,
          phase: 'DATA_COLLECTION',
          dataCollectionPhase: 'COLLECTING',
          dataCollectionStep: currentStep + 1,
          dataCollected: collected,
        }
        const nextQuestion = calibrationQuestions[currentStep + 1]
        await saveStateAndMessage(sessionId, nextState, nextQuestion, 'DATA_COLLECTION')
        response = { text: nextQuestion, phase: 'DATA_COLLECTION' }
        break
      }

      const detectedLevel = inferCompetenceFromCollectedAnswers(collected)
      const transitionText = bot.language === 'it'
        ? 'Perfetto, ora ho contesto e obiettivo pratico. Iniziamo con il primo argomento.'
        : 'Great, I now have enough context and practical goals. Let us start with the first topic.'

      const nextState: TrainingSupervisorState = {
        ...state,
        phase: 'EXPLAINING',
        detectedCompetenceLevel: detectedLevel,
        adaptationDepth: detectedLevel === 'BEGINNER' ? 1 : 0,
        dataCollectionPhase: 'DONE',
        dataCollectionStep: calibrationQuestions.length,
        dataCollected: collected,
      }

      await saveStateAndMessage(sessionId, nextState, transitionText, 'DATA_COLLECTION')
      response = { text: transitionText, phase: 'EXPLAINING' }
      break
    }

    case 'EXPLAINING':
    case 'RETRYING': {
      const systemPrompt = state.phase === 'RETRYING'
        ? buildRetryingPrompt({
            topicLabel: currentTopic.label,
            topicDescription: currentTopic.description ?? undefined,
            learningObjectives: currentTopic.learningObjectives,
            educationLevel: bot.traineeEducationLevel,
            competenceLevel: state.detectedCompetenceLevel,
            adaptationDepth: state.adaptationDepth,
            kbContent,
            gaps: state.pendingRetryGaps ?? [],
            language: bot.language,
            learnerProfile,
          })
        : buildExplainingPrompt({
            topicLabel: currentTopic.label,
            topicDescription: currentTopic.description ?? undefined,
            learningObjectives: currentTopic.learningObjectives,
            educationLevel: bot.traineeEducationLevel,
            competenceLevel: state.detectedCompetenceLevel,
            adaptationDepth: state.adaptationDepth,
            kbContent,
            language: bot.language,
            learnerProfile,
          })

      const explainResult = await generateText({
        model,
        system: systemPrompt,
        prompt: userMessage,
        maxOutputTokens: 180,
      })
      await logTrainingTokens(bot.organizationId, bot.modelName, explainResult.usage, 'training-explain')

      // Transition to DIALOGUING (replaces old CHECKING flow)
      const newState: TrainingSupervisorState = {
        ...state,
        phase: 'DIALOGUING' as const,
        dialogueTurns: 0,
      }
      await saveStateAndMessage(sessionId, newState, explainResult.text, state.phase as TrainingPhase)
      response = { text: explainResult.text, phase: 'DIALOGUING' }
      break
    }

    case 'DIALOGUING': {
      const minTurns = currentTopic.minCheckingTurns ?? 2
      const maxTurns = currentTopic.maxCheckingTurns ?? 6
      const newTurnCount = (state.dialogueTurns ?? 0) + 1

      // Keep a compact rolling history so the tutor can stay coherent without overloading context.
      const recentMessages = session.messages
        .filter((m) => m.phase === 'EXPLAINING' || m.phase === 'DIALOGUING')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        .slice(-12)

      const currentTopicHistory = (state.comprehensionHistory ?? []).filter(
        (e) => e.topicIndex === state.currentTopicIndex
      )

      // Build dialogue system prompt
      const dialogueSystemPrompt = buildDialoguePrompt(
        {
          topicLabel: currentTopic.label,
          topicDescription: currentTopic.description ?? undefined,
          learningObjectives: currentTopic.learningObjectives,
          educationLevel: bot.traineeEducationLevel,
          competenceLevel: state.detectedCompetenceLevel,
          adaptationDepth: state.adaptationDepth,
          kbContent,
          language: bot.language,
          dialogueTurns: newTurnCount,
          minCheckingTurns: minTurns,
          maxCheckingTurns: maxTurns,
          learnerProfile,
        },
        recentMessages,
        currentTopicHistory
      )

      const evaluationSchema = z.object({
        comprehensionLevel: z.number().min(0).max(100),
        engagementLevel: z.enum(['high', 'medium', 'low']),
        gaps: z.array(z.string()),
        understoodConcepts: z.array(z.string()),
        readyToProgress: z.boolean(),
        suggestedApproach: z.enum(['deepen', 'clarify', 'example', 'simpler', 'prerequisite', 'summarize']),
      })

      // Run tutor response and silent comprehension evaluation in parallel
      const [tutorResult, evalResult] = await Promise.all([
        generateText({ model, system: dialogueSystemPrompt, prompt: userMessage, maxOutputTokens: 140 }),
        generateObject({
          model,
          schema: z.object({ evaluation: evaluationSchema }),
          system: `Sei un valutatore silenzioso. Analizza la risposta dello studente e valuta comprensione ed engagement.
Topic: "${currentTopic.label}" | Obiettivi: ${currentTopic.learningObjectives.join('; ')}
Precedente approccio usato: ${currentTopicHistory.at(-1)?.suggestedApproach ?? 'nessuno'}`,
          prompt: `Risposta studente: "${userMessage}"\nValuta senza rispondere allo studente.`,
        }),
      ])

      await Promise.all([
        logTrainingTokens(bot.organizationId, bot.modelName, tutorResult.usage, 'training-dialogue'),
        logTrainingTokens(bot.organizationId, bot.modelName, evalResult.usage, 'training-eval'),
      ])

      const eval_ = evalResult.object.evaluation

      const newEntry: ComprehensionEntry = {
        topicIndex: state.currentTopicIndex,
        turn: newTurnCount,
        comprehensionLevel: eval_.comprehensionLevel,
        engagementLevel: eval_.engagementLevel,
        gaps: eval_.gaps,
        understoodConcepts: eval_.understoodConcepts,
        suggestedApproach: eval_.suggestedApproach,
      }

      // Determine if we should advance to next topic
      const shouldAdvance =
        (eval_.readyToProgress && newTurnCount >= minTurns) || newTurnCount >= maxTurns

      if (shouldAdvance) {
        // Compute final comprehension as average across this topic's turns
        const thisTopicEntries = [...currentTopicHistory, newEntry]
        const avgComp = Math.round(
          thisTopicEntries.reduce((sum, e) => sum + e.comprehensionLevel, 0) / thisTopicEntries.length
        )
        const allGaps = [...new Set(thisTopicEntries.flatMap((e) => e.gaps))]
        const allUnderstood = [...new Set(thisTopicEntries.flatMap((e) => e.understoodConcepts))]

        const dialogueTopicResult = {
          topicId: currentTopic.id,
          topicLabel: currentTopic.label,
          finalComprehension: avgComp,
          gaps: allGaps,
          understoodConcepts: allUnderstood,
          turnsUsed: newTurnCount,
        }

        const stateWithHistory: TrainingSupervisorState = {
          ...state,
          comprehensionHistory: [...(state.comprehensionHistory ?? []), newEntry],
          dialogueTurns: newTurnCount,
        }

        const { newState: advancedState, isFinalQuiz } = advanceDialogueTopic(
          stateWithHistory,
          dialogueTopicResult,
          topics.length
        )

        if (isFinalQuiz) {
          // Generate final quiz weighted by dialogue gaps
          const allTopicLabels = topics.map((t) => t.label)
          const quizResult = await generateObject({
            model,
            schema: z.object({
              questions: z.array(z.object({
                id: z.string(),
                type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'OPEN_ANSWER']),
                question: z.string(),
                options: z.array(z.string()).optional(),
                correctIndex: z.number().optional(),
                expectedKeyPoints: z.array(z.string()).optional(),
              })).min(3).max(12),
            }),
            system: buildFinalQuizSystemPrompt(
              allTopicLabels,
              advancedState.dialogueTopicResults,
              bot.language
            ),
            prompt: `Genera il quiz finale. Copri tutti i ${topics.length} topic.`,
          })
          await logTrainingTokens(bot.organizationId, bot.modelName, quizResult.usage, 'training-final-quiz-gen')

          const finalQuizQuestions = normalizeFinalQuizQuestions(
            quizResult.object.questions as QuizQuestion[],
            bot.language
          )
          const finalState = { ...advancedState, finalQuizQuestions }

          const quizIntro = bot.language === 'it'
            ? `Ottimo! Hai completato tutti gli argomenti del percorso. Ora verificheremo la tua comprensione con un quiz finale:`
            : `Great! You've completed all topics. Let's verify your understanding with a final quiz:`

          await saveStateAndMessage(sessionId, finalState, quizIntro, 'DIALOGUING' as TrainingPhase)
          response = {
            text: quizIntro,
            phase: 'FINAL_QUIZZING',
            quizPayload: { questions: finalQuizQuestions },
            topicResult: dialogueResultToTopicResult(dialogueTopicResult, bot.passScoreThreshold),
          }
        } else {
          // Advance to next topic
          const nextTopic = topics[advancedState.currentTopicIndex]
          const understoodHint = eval_.understoodConcepts.at(0)
          const advanceText = bot.language === 'it'
            ? (understoodHint
                ? `Ottimo, hai centrato: ${understoodHint}. Passiamo al prossimo argomento: "${nextTopic?.label}".`
                : `Ottimo. Passiamo al prossimo argomento: "${nextTopic?.label}".`)
            : (understoodHint
                ? `Great, you got this point: ${understoodHint}. Let's move to the next topic: "${nextTopic?.label}".`
                : `Great. Let's move to the next topic: "${nextTopic?.label}".`)

          await saveStateAndMessage(sessionId, advancedState, advanceText, 'DIALOGUING' as TrainingPhase)
          response = {
            text: advanceText,
            phase: 'EXPLAINING',
            topicResult: dialogueResultToTopicResult(dialogueTopicResult, bot.passScoreThreshold),
          }
        }
      } else {
        // Continue dialogue — update history and turn count
        const continuedState: TrainingSupervisorState = {
          ...state,
          dialogueTurns: newTurnCount,
          comprehensionHistory: [...(state.comprehensionHistory ?? []), newEntry],
        }
        const cleanedTutorText = stripTopicTransitionFromTutorText(tutorResult.text)
        await saveStateAndMessage(sessionId, continuedState, cleanedTutorText, 'DIALOGUING' as TrainingPhase)
        response = { text: cleanedTutorText, phase: 'DIALOGUING' }
      }
      break
    }

    // Keep CHECKING/QUIZZING/EVALUATING for backward compatibility with old sessions
    case 'CHECKING': {
      const checkQuestion = state.pendingCheckQuestion ?? '(domanda aperta)'
      const openEval = await evaluateOpenAnswer(
        checkQuestion,
        userMessage,
        currentTopic.learningObjectives,
        state.detectedCompetenceLevel,
        model
      )

      const preWritten = currentTopic.preWrittenQuizzes as QuizQuestion[] | null
      let quizzes: QuizQuestion[]

      if (preWritten && preWritten.length > 0) {
        quizzes = preWritten.slice(0, 3)
      } else {
        const quizResult = await generateObject({
          model,
          schema: z.object({
            questions: z.array(z.object({
              id: z.string(),
              type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE']),
              question: z.string(),
              options: z.array(z.string()),
              correctIndex: z.number(),
            })).min(1).max(3),
          }),
          system: buildQuizzingSystemPrompt({
            topicLabel: currentTopic.label,
            learningObjectives: currentTopic.learningObjectives,
            educationLevel: bot.traineeEducationLevel,
            competenceLevel: state.detectedCompetenceLevel,
            adaptationDepth: state.adaptationDepth,
            language: bot.language,
          }),
          prompt: `Genera 2-3 domande di verifica sul topic "${currentTopic.label}".`,
        })
        await logTrainingTokens(bot.organizationId, bot.modelName, quizResult.usage, 'training-generate-quiz')
        quizzes = quizResult.object.questions
      }

      const newState: TrainingSupervisorState = {
        ...state,
        phase: 'QUIZZING',
        pendingQuizzes: quizzes,
        topicResults: [
          ...state.topicResults,
          { topicId: currentTopic.id, topicLabel: currentTopic.label, status: 'GAP_DETECTED',
            score: openEval.score, openAnswerScore: openEval.score, quizScore: 0,
            retries: state.retryCount, gaps: openEval.gaps, feedback: openEval.feedback },
        ],
      }

      const introText = bot.language === 'it'
        ? 'Bene! Ora alcune domande di verifica:'
        : 'Good! Now a few verification questions:'

      await saveStateAndMessage(sessionId, newState, introText, 'CHECKING')
      response = { text: introText, phase: 'QUIZZING', quizPayload: { questions: quizzes } }
      break
    }

    case 'QUIZZING': {
      const quizzes = state.pendingQuizzes ?? []
      const selectedIndexes = parseQuizAnswers(userMessage, quizzes.length)
      const quizEval = evaluateQuizAnswers(quizzes, selectedIndexes)

      const tempResult = state.topicResults.at(-1)
      const openScore = tempResult?.openAnswerScore ?? 0
      const finalScore = computeTopicScore(openScore, quizEval.score)

      const threshold = currentTopic.passScoreOverride ?? bot.passScoreThreshold
      const status: 'PASSED' | 'FAILED' | 'GAP_DETECTED' = finalScore >= threshold
        ? 'PASSED'
        : (state.retryCount >= (currentTopic.maxRetriesOverride ?? bot.maxRetries) ? 'FAILED' : 'GAP_DETECTED')

      const topicResult = {
        topicId: currentTopic.id,
        topicLabel: currentTopic.label,
        status,
        score: finalScore,
        openAnswerScore: openScore,
        quizScore: quizEval.score,
        retries: state.retryCount,
        gaps: tempResult?.gaps ?? [],
        feedback: tempResult?.feedback ?? '',
      }

      const resultsWithoutTemp = state.topicResults.slice(0, -1)
      const stateWithResult = { ...state, topicResults: resultsWithoutTemp }

      const botConfig = { passScoreThreshold: bot.passScoreThreshold, maxRetries: bot.maxRetries, failureMode: bot.failureMode as 'STRICT' | 'PERMISSIVE' }
      const topicConfig = { id: currentTopic.id, label: currentTopic.label, learningObjectives: currentTopic.learningObjectives, passScoreOverride: currentTopic.passScoreOverride, maxRetriesOverride: currentTopic.maxRetriesOverride }

      const { newState, moveToNextTopic } = advanceAfterEvaluation(stateWithResult, topicResult, botConfig, topicConfig, topics.length)

      const userAnswers = session.messages.filter(m => m.role === 'user').map(m => m.content)
      const detectedLevel = detectCompetenceLevel(userAnswers)
      const finalState = { ...newState, detectedCompetenceLevel: detectedLevel }

      let text: string
      if (finalState.phase === 'COMPLETE') {
        const overallScore = computeOverallScore(finalState.topicResults)
        const passed = computeSessionPassed(finalState.topicResults, bot.passScoreThreshold)
        const feedbackResult = await generateText({
          model,
          system: buildFinalFeedbackPrompt(finalState.topicResults, overallScore, passed, bot.language),
          prompt: 'Genera il messaggio di chiusura.',
        })
        await logTrainingTokens(bot.organizationId, bot.modelName, feedbackResult.usage, 'training-final-feedback')
        text = feedbackResult.text

        await prisma.trainingSession.update({
          where: { id: sessionId },
          data: {
            status: passed ? 'COMPLETED' : 'FAILED',
            passed,
            overallScore,
            completedAt: new Date(),
            durationSeconds: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
            topicResults: finalState.topicResults as any,
            supervisorState: finalState as any,
          },
        })

        await prisma.trainingMessage.create({
          data: { trainingSessionId: sessionId, role: 'assistant', phase: 'COMPLETE', content: text },
        })

        return { text, phase: 'COMPLETE', topicResult, sessionComplete: true, overallScore, passed }
      } else if (finalState.phase === 'RETRYING') {
        text = bot.language === 'it'
          ? `Proviamo a ripassare questo argomento. Focalizziamoci su: ${topicResult.gaps.join(', ') || 'i punti chiave'}.`
          : `Let's review this topic again, focusing on: ${topicResult.gaps.join(', ') || 'the key points'}.`
      } else if (moveToNextTopic) {
        const nextTopic = topics[finalState.currentTopicIndex]
        text = bot.language === 'it'
          ? `Ottimo! Passiamo al prossimo argomento: "${nextTopic?.label}".`
          : `Great! Let's move to the next topic: "${nextTopic?.label}".`
      } else {
        text = bot.language === 'it' ? 'Procediamo.' : 'Let\'s continue.'
      }

      await saveStateAndMessage(sessionId, finalState, text, 'QUIZZING')
      response = { text, phase: finalState.phase, topicResult }
      break
    }

    case 'FINAL_QUIZZING': {
      const questions = state.finalQuizQuestions ?? []
      if (questions.length === 0) {
        response = { text: 'Quiz finale non disponibile.', phase: 'FINAL_QUIZZING' }
        break
      }

      // Parse mixed answers (number for MC/TF, string for open answers)
      let answers: Array<number | string> = []
      try {
        const parsed = JSON.parse(userMessage)
        if (Array.isArray(parsed)) answers = parsed
      } catch {
        answers = new Array(questions.length).fill(0)
      }

      let totalScore = 0
      const allGaps: string[] = []

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const answer = answers[i]

        if (q.type === 'OPEN_ANSWER') {
          const result = await evaluateOpenAnswer(
            q.question,
            String(answer ?? ''),
            currentTopic?.learningObjectives ?? [],
            state.detectedCompetenceLevel,
            model
          )
          totalScore += result.score
          allGaps.push(...result.gaps)
        } else {
          const correct = typeof answer === 'number' && answer === q.correctIndex
          totalScore += correct ? 100 : 0
          if (!correct && q.question) {
            allGaps.push(`Risposta errata: "${q.question}"`)
          }
        }
      }

      const overallScore = Math.round(totalScore / Math.max(questions.length, 1))
      const passed = overallScore >= bot.passScoreThreshold

      const feedbackResult = await generateText({
        model,
        system: buildFinalFeedbackPrompt(
          state.dialogueTopicResults.map((r) => ({
            topicLabel: r.topicLabel,
            status: r.finalComprehension >= bot.passScoreThreshold ? 'PASSED' : 'GAP_DETECTED',
            score: r.finalComprehension,
            gaps: r.gaps,
          })),
          overallScore,
          passed,
          bot.language
        ),
        prompt: 'Genera il messaggio di chiusura.',
      })
      await logTrainingTokens(bot.organizationId, bot.modelName, feedbackResult.usage, 'training-final-feedback')

      const finalState: TrainingSupervisorState = { ...state, phase: 'COMPLETE' }

      await prisma.$transaction([
        prisma.trainingSession.update({
          where: { id: sessionId },
          data: {
            status: passed ? 'COMPLETED' : 'FAILED',
            passed,
            overallScore,
            completedAt: new Date(),
            durationSeconds: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
            topicResults: state.dialogueTopicResults.map((r) =>
              dialogueResultToTopicResult(r, bot.passScoreThreshold)
            ) as any,
            supervisorState: finalState as any,
          },
        }),
        prisma.trainingMessage.create({
          data: { trainingSessionId: sessionId, role: 'assistant', phase: 'COMPLETE', content: feedbackResult.text },
        }),
      ])

      response = {
        text: feedbackResult.text,
        phase: 'COMPLETE',
        sessionComplete: true,
        overallScore,
        passed,
      }
      break
    }

    default:
      response = { text: 'Stato non riconosciuto.', phase: state.phase }
  }

  return response
}

function dialogueResultToTopicResult(r: DialogueTopicResult, passThreshold: number, quizScore?: number): TopicResult {
  const normalizedQuizScore =
    typeof quizScore === 'number' && Number.isFinite(quizScore)
      ? Math.max(0, Math.min(100, Math.round(quizScore)))
      : Math.max(0, Math.min(100, Math.round(r.finalComprehension)))

  return {
    topicId: r.topicId,
    topicLabel: r.topicLabel,
    status: r.finalComprehension >= passThreshold ? 'PASSED' : 'GAP_DETECTED',
    score: Math.max(0, Math.min(100, Math.round(r.finalComprehension))),
    openAnswerScore: Math.max(0, Math.min(100, Math.round(r.finalComprehension))),
    quizScore: normalizedQuizScore,
    retries: 0,
    gaps: r.gaps,
    feedback: r.understoodConcepts.join(', '),
  }
}

function parseQuizAnswers(input: string, count: number): number[] {
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) return parsed.map(Number)
  } catch {}
  const parts = input.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === count && parts.every(n => !isNaN(n))) return parts
  return new Array(count).fill(0)
}

async function saveStateAndMessage(
  sessionId: string,
  state: TrainingSupervisorState,
  text: string,
  phase: TrainingPhase
) {
  await Promise.all([
    prisma.trainingSession.update({
      where: { id: sessionId },
      data: { supervisorState: state as any },
    }),
    prisma.trainingMessage.create({
      data: {
        trainingSessionId: sessionId,
        role: 'assistant',
        phase: normalizeTrainingPhase(phase),
        content: text,
      },
    }),
  ])
}
