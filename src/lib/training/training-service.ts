// src/lib/training/training-service.ts
import { generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  buildExplainingPrompt,
  buildCheckingPrompt,
  buildQuizzingSystemPrompt,
  buildRetryingPrompt,
  buildFinalFeedbackPrompt,
} from './training-prompts'
import {
  buildInitialState,
  advanceAfterEvaluation,
  computeOverallScore,
  computeSessionPassed,
} from './training-supervisor'
import { evaluateOpenAnswer, evaluateQuizAnswers, computeTopicScore, detectCompetenceLevel } from './training-evaluator'
import type { TrainingSupervisorState, TrainingChatResponse, QuizQuestion } from './training-types'

function getModel(provider: string, name: string, customKey?: string | null) {
  if (provider === 'anthropic') {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })(name)
  }
  return createOpenAI({ apiKey: customKey ?? process.env.OPENAI_API_KEY ?? '' })(name)
}

export async function processTrainingMessage(
  sessionId: string,
  userMessage: string
): Promise<TrainingChatResponse> {
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

  if (state.phase === 'COMPLETE') {
    return { text: 'Il percorso formativo è già completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const currentTopic = topics[state.currentTopicIndex]
  if (!currentTopic) {
    return { text: 'Percorso completato.', phase: 'COMPLETE', sessionComplete: true }
  }

  const model = getModel(bot.modelProvider, bot.modelName, bot.customApiKey)
  const kbContent = bot.knowledgeSources[0]?.content ?? undefined

  // 2. Save user message
  await prisma.trainingMessage.create({
    data: { trainingSessionId: sessionId, role: 'user', phase: state.phase, content: userMessage },
  })

  // 3. Handle phase
  let response: TrainingChatResponse

  switch (state.phase) {
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
          })

      const { text } = await generateText({ model, system: systemPrompt, prompt: userMessage })
      const checkPrompt = buildCheckingPrompt({
        topicLabel: currentTopic.label,
        learningObjectives: currentTopic.learningObjectives,
        educationLevel: bot.traineeEducationLevel,
        competenceLevel: state.detectedCompetenceLevel,
        adaptationDepth: state.adaptationDepth,
        language: bot.language,
      })
      const { text: checkQuestion } = await generateText({ model, system: checkPrompt, prompt: 'Fai la domanda.' })
      const newState = { ...state, phase: 'CHECKING' as const, pendingCheckQuestion: checkQuestion }
      const combinedText = `${text}\n\n${checkQuestion}`
      await saveStateAndMessage(sessionId, newState, combinedText, state.phase)
      response = { text: combinedText, phase: 'CHECKING' }
      break
    }

    case 'CHECKING': {
      // User answered open question — generate quiz
      const checkQuestion = state.pendingCheckQuestion ?? '(domanda aperta)'
      const openEval = await evaluateOpenAnswer(
        checkQuestion,
        userMessage,
        currentTopic.learningObjectives,
        state.detectedCompetenceLevel,
        bot.modelName
      )

      // Generate quizzes
      const preWritten = currentTopic.preWrittenQuizzes as QuizQuestion[] | null
      let quizzes: QuizQuestion[]

      if (preWritten && preWritten.length > 0) {
        quizzes = preWritten.slice(0, 3)
      } else {
        const { object } = await generateObject({
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
        quizzes = object.questions
      }

      const newState: TrainingSupervisorState = {
        ...state,
        phase: 'QUIZZING',
        pendingQuizzes: quizzes,
        // store open eval for later scoring
        topicResults: [
          ...state.topicResults,
          // temp partial result (will be replaced after quiz)
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
      // Parse selected indexes from userMessage (format: "0,1,1" or JSON array)
      const quizzes = state.pendingQuizzes ?? []
      const selectedIndexes = parseQuizAnswers(userMessage, quizzes.length)
      const quizEval = evaluateQuizAnswers(quizzes, selectedIndexes)

      // Get stored open answer score from temp result
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

      // Remove temp result, add final
      const resultsWithoutTemp = state.topicResults.slice(0, -1)
      const stateWithResult = { ...state, topicResults: resultsWithoutTemp }

      const botConfig = { passScoreThreshold: bot.passScoreThreshold, maxRetries: bot.maxRetries, failureMode: bot.failureMode as 'STRICT' | 'PERMISSIVE' }
      const topicConfig = { id: currentTopic.id, label: currentTopic.label, learningObjectives: currentTopic.learningObjectives, passScoreOverride: currentTopic.passScoreOverride, maxRetriesOverride: currentTopic.maxRetriesOverride }

      const { newState, moveToNextTopic } = advanceAfterEvaluation(stateWithResult, topicResult, botConfig, topicConfig, topics.length)

      // Detect competence from all user answers
      const userAnswers = session.messages.filter(m => m.role === 'user').map(m => m.content)
      const detectedLevel = detectCompetenceLevel(userAnswers)
      const finalState = { ...newState, detectedCompetenceLevel: detectedLevel }

      // Generate response text
      let text: string
      if (finalState.phase === 'COMPLETE') {
        const overallScore = computeOverallScore(finalState.topicResults)
        const passed = computeSessionPassed(finalState.topicResults, bot.passScoreThreshold)
        const { text: feedbackText } = await generateText({
          model,
          system: buildFinalFeedbackPrompt(finalState.topicResults, overallScore, passed, bot.language),
          prompt: 'Genera il messaggio di chiusura.',
        })
        text = feedbackText

        // Update session as complete
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

    default:
      response = { text: 'Stato non riconosciuto.', phase: state.phase }
  }

  return response
}

function parseQuizAnswers(input: string, count: number): number[] {
  try {
    const parsed = JSON.parse(input)
    if (Array.isArray(parsed)) return parsed.map(Number)
  } catch {}
  // fallback: comma-separated "0,1,1"
  const parts = input.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === count && parts.every(n => !isNaN(n))) return parts
  return new Array(count).fill(0)
}

async function saveStateAndMessage(
  sessionId: string,
  state: TrainingSupervisorState,
  text: string,
  phase: string
) {
  await Promise.all([
    prisma.trainingSession.update({
      where: { id: sessionId },
      data: { supervisorState: state as any },
    }),
    prisma.trainingMessage.create({
      data: { trainingSessionId: sessionId, role: 'assistant', phase: phase as any, content: text },
    }),
  ])
}
