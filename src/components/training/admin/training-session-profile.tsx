'use client'

import type { TopicResult } from '@/lib/training/training-types'

const statusIcon: Record<string, string> = {
  PASSED: '✅',
  FAILED: '❌',
  GAP_DETECTED: '⚠️',
}

const statusLabel: Record<string, string> = {
  STARTED: 'In corso',
  COMPLETED: 'Completata',
  FAILED: 'Fallita',
  ABANDONED: 'Abbandonata',
}

const statusColors: Record<string, string> = {
  STARTED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-600',
  ABANDONED: 'bg-gray-100 text-gray-600',
}

interface SessionData {
  participantId: string
  status: string
  overallScore: number | null
  passed: boolean | null
  startedAt: Date
  completedAt: Date | null
  durationSeconds: number | null
  detectedCompetenceLevel: string | null
  topicResults: TopicResult[]
  traineeProfile: Record<string, string> | null
}

interface Props {
  session: SessionData
  configuredCompetenceLevel: string
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  )
}

export default function TrainingSessionProfile({ session, configuredCompetenceLevel }: Props) {
  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[session.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {statusLabel[session.status] ?? session.status}
              </span>
              {session.passed !== null && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${session.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                >
                  {session.passed ? 'Superato' : 'Non superato'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-mono mt-1">{session.participantId}</p>
          </div>

          {session.overallScore !== null && (
            <div className="text-right">
              <p className="text-4xl font-bold text-gray-900">
                {Math.round(session.overallScore)}%
              </p>
              <p className="text-sm text-gray-500">Punteggio totale</p>
            </div>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Inizio</p>
            <p className="text-sm font-medium text-gray-700">{formatDate(session.startedAt)}</p>
          </div>

          {session.completedAt && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fine</p>
              <p className="text-sm font-medium text-gray-700">{formatDate(session.completedAt)}</p>
            </div>
          )}

          {session.durationSeconds !== null && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Durata</p>
              <p className="text-sm font-medium text-gray-700">
                {formatDuration(session.durationSeconds)}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Livello rilevato</p>
            <p className="text-sm font-medium text-gray-700">
              {session.detectedCompetenceLevel ?? configuredCompetenceLevel}
            </p>
          </div>
        </div>
      </div>

      {/* Per-Topic Results */}
      {session.topicResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Risultati per argomento</h2>
          <div className="space-y-4">
            {session.topicResults.map((topic, idx) => (
              <div key={topic.topicId ?? idx} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" role="img" aria-label={topic.status}>
                      {statusIcon[topic.status] ?? '—'}
                    </span>
                    <h3 className="font-medium text-gray-900">{topic.topicLabel}</h3>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-lg font-bold text-gray-900">{Math.round(topic.score)}%</p>
                    {topic.retries > 0 && (
                      <p className="text-xs text-gray-400">{topic.retries} {topic.retries === 1 ? 'tentativo' : 'tentativi'}</p>
                    )}
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Risposta aperta</span>
                      <span>{Math.round(topic.openAnswerScore)}%</span>
                    </div>
                    <ScoreBar score={topic.openAnswerScore} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Quiz</span>
                      <span>{Math.round(topic.quizScore)}%</span>
                    </div>
                    <ScoreBar score={topic.quizScore} />
                  </div>
                </div>

                {/* Feedback */}
                {topic.feedback && (
                  <p className="text-sm text-gray-600 mb-2">{topic.feedback}</p>
                )}

                {/* Gaps */}
                {topic.gaps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-700 mb-1">Lacune rilevate:</p>
                    <ul className="space-y-1">
                      {topic.gaps.map((gap, gapIdx) => (
                        <li key={gapIdx} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trainee Profile */}
      {session.traineeProfile && Object.keys(session.traineeProfile).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Profilo del partecipante</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(session.traineeProfile).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <dt className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{key}</dt>
                <dd className="text-sm font-medium text-gray-700">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
