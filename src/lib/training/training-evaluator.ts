// src/lib/training/training-evaluator.ts
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import type { QuizQuestion, EvaluationResult, QuizEvaluationResult } from './training-types'

/** Weighted score: 40% open answer + 60% quiz */
export function computeTopicScore(openAnswerScore: number, quizScore: number): number {
  return Math.round(openAnswerScore * 0.4 + quizScore * 0.6)
}

/** Evaluate structured quiz answers locally (no LLM needed) */
export function evaluateQuizAnswers(
  questions: QuizQuestion[],
  selectedIndexes: number[]
): QuizEvaluationResult {
  const wrongAnswers: QuizQuestion[] = []
  let correct = 0

  questions.forEach((q, i) => {
    if (selectedIndexes[i] === q.correctIndex) {
      correct++
    } else {
      wrongAnswers.push(q)
    }
  })

  return {
    score: questions.length === 0 ? 100 : Math.round((correct / questions.length) * 100),
    wrongAnswers,
  }
}

/** Use LLM to evaluate an open-answer response */
export async function evaluateOpenAnswer(
  question: string,
  answer: string,
  learningObjectives: string[],
  competenceLevel: string,
  modelName = 'gpt-4o-mini'
): Promise<EvaluationResult> {
  if (!answer || answer.trim().length < 5) {
    return { score: 0, gaps: ['Nessuna risposta fornita'], feedback: 'Non è stata fornita una risposta.' }
  }

  try {
    const { object } = await generateObject({
      model: openai(modelName),
      schema: z.object({
        score: z.number().min(0).max(100),
        gaps: z.array(z.string()),
        feedback: z.string(),
      }),
      prompt: `Valuta questa risposta a una domanda di verifica formativa.

Domanda: ${question}
Risposta del trainee: ${answer}
Obiettivi di apprendimento: ${learningObjectives.join('; ')}
Livello di competenza atteso: ${competenceLevel}

Valuta:
- score: 0-100 (quanto la risposta dimostra comprensione degli obiettivi)
- gaps: array di lacune specifiche rilevate (vuoto se score >= 70)
- feedback: breve valutazione in italiano (max 2 frasi) per il report del formatore

Sii rigoroso ma equo. Considera la correttezza del concetto, non la forma.`,
    })
    return object
  } catch (err) {
    console.error('[evaluateOpenAnswer] LLM call failed', err)
    return {
      score: 0,
      gaps: ['Errore nella valutazione automatica'],
      feedback: 'Impossibile elaborare la risposta in questo momento.',
    }
  }
}

/** Infer competence level from message history quality */
export function detectCompetenceLevel(
  answers: string[]
): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  if (answers.length === 0) return 'INTERMEDIATE'

  const avgLength = answers.reduce((sum, a) => sum + a.split(' ').length, 0) / answers.length
  const hasLongAnswer = answers.some(a => a.length > 100)

  if (avgLength < 10 && !hasLongAnswer) return 'BEGINNER'
  if (avgLength > 40 || hasLongAnswer) return 'ADVANCED'
  return 'INTERMEDIATE'
}
