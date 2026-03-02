// src/lib/training/training-types.ts

export type TrainingPhaseType =
  | 'EXPLAINING'
  | 'CHECKING'
  | 'QUIZZING'
  | 'EVALUATING'
  | 'RETRYING'
  | 'DATA_COLLECTION'
  | 'DIALOGUING'
  | 'FINAL_QUIZZING'
  | 'COMPLETE'

export type DetectedCompetenceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export interface QuizQuestion {
  id: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_ANSWER'
  question: string
  options?: string[]            // MULTIPLE_CHOICE and TRUE_FALSE only
  correctIndex?: number         // MULTIPLE_CHOICE and TRUE_FALSE only
  expectedKeyPoints?: string[]  // OPEN_ANSWER only
}

export interface ComprehensionEntry {
  topicIndex: number
  turn: number
  comprehensionLevel: number   // 0–100
  engagementLevel: 'high' | 'medium' | 'low'
  gaps: string[]
  understoodConcepts: string[]
  suggestedApproach: 'deepen' | 'clarify' | 'example' | 'simpler' | 'prerequisite' | 'summarize'
}

export interface DialogueTopicResult {
  topicId: string
  topicLabel: string
  finalComprehension: number   // average comprehensionLevel across all turns
  gaps: string[]               // cumulative unresolved gaps
  understoodConcepts: string[]
  turnsUsed: number
}

export interface TopicResult {
  topicId: string
  topicLabel: string
  status: 'PASSED' | 'FAILED' | 'GAP_DETECTED'
  score: number            // 0–100 weighted final
  openAnswerScore: number  // 0–100
  quizScore: number        // 0–100
  retries: number
  gaps: string[]
  feedback: string
}

export interface TrainingSupervisorState {
  currentTopicIndex: number
  phase: TrainingPhaseType
  retryCount: number
  detectedCompetenceLevel: DetectedCompetenceLevel
  adaptationDepth: number         // 0=default, 1=simpler, 2=max simple
  topicResults: TopicResult[]     // legacy: used by old CHECKING/QUIZZING flow
  // New DIALOGUING fields
  dialogueTurns: number           // current turn count in active DIALOGUING topic
  comprehensionHistory: ComprehensionEntry[]
  dialogueTopicResults: DialogueTopicResult[]   // one per completed dialogue topic
  finalQuizQuestions?: QuizQuestion[]            // set when entering FINAL_QUIZZING
  // Legacy fields (retained for backward compat with old sessions)
  pendingQuizzes?: QuizQuestion[]
  pendingCheckQuestion?: string
  pendingRetryGaps?: string[]
  dataCollectionPhase?: 'CONSENT' | 'COLLECTING' | 'DONE'
  dataCollected?: Record<string, string>
}

export interface EvaluationResult {
  score: number
  gaps: string[]
  feedback: string
}

export interface QuizEvaluationResult {
  score: number
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
  explanationCues: string[]
  commonMisconceptions: string[]
}
