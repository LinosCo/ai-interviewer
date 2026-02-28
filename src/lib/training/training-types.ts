// src/lib/training/training-types.ts

export type TrainingPhaseType =
  | 'EXPLAINING'
  | 'CHECKING'
  | 'QUIZZING'
  | 'EVALUATING'
  | 'RETRYING'
  | 'DATA_COLLECTION'
  | 'COMPLETE'

export type DetectedCompetenceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  question: string
  options: string[]       // for TRUE_FALSE use ['Vero', 'Falso']
  correctIndex: number
}

export interface TopicResult {
  topicId: string
  topicLabel: string
  status: 'PASSED' | 'FAILED' | 'GAP_DETECTED'
  score: number           // 0-100 weighted final
  openAnswerScore: number // 0-100
  quizScore: number       // 0-100
  retries: number
  gaps: string[]
  feedback: string
}

export interface TrainingSupervisorState {
  currentTopicIndex: number
  phase: TrainingPhaseType
  retryCount: number
  detectedCompetenceLevel: DetectedCompetenceLevel
  adaptationDepth: number   // 0=configured, 1=one level simpler, 2=max simple
  topicResults: TopicResult[]
  pendingQuizzes?: QuizQuestion[]    // quizzes generated, waiting for answers
  pendingCheckQuestion?: string      // open question asked, waiting for answer
  dataCollectionPhase?: 'CONSENT' | 'COLLECTING' | 'DONE'
  dataCollected?: Record<string, string>
}

export interface EvaluationResult {
  score: number      // 0-100
  gaps: string[]
  feedback: string
}

export interface QuizEvaluationResult {
  score: number       // 0-100
  wrongAnswers: QuizQuestion[]
}

export interface TrainingChatResponse {
  text: string
  phase: TrainingPhaseType
  quizPayload?: { questions: QuizQuestion[] }
  topicResult?: TopicResult
  sessionComplete?: boolean
  overallScore?: number
  passed?: boolean
}

export interface RuntimeTrainingKnowledge {
  topicId: string
  topicLabel: string
  keyConceptSummary: string
  explanationCues: string[]   // how to explain clearly
  commonMisconceptions: string[]
}
