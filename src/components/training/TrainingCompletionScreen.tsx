'use client'
import type { TopicResult } from '@/lib/training/training-types'
import { Button } from '@/components/ui/button'

const statusIcon: Record<string, string> = { PASSED: '✅', FAILED: '❌', GAP_DETECTED: '⚠️' }
const statusLabel: Record<string, string> = { PASSED: 'Superato', FAILED: 'Non superato', GAP_DETECTED: 'Lacune rilevate' }

interface Props {
  botName: string
  overallScore: number
  passed: boolean
  topicResults: TopicResult[]
  primaryColor: string
}

export default function TrainingCompletionScreen({ botName, overallScore, passed, topicResults, primaryColor }: Props) {
  // primaryColor is accepted for future use (e.g. button theming); suppress unused-var lint
  void primaryColor

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{passed ? '🎉' : '📚'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{botName}</h1>
          <p className="text-gray-500 text-sm">Percorso formativo completato</p>
        </div>

        <div className={`rounded-xl p-4 mb-6 text-center ${passed ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className={`text-3xl font-bold ${passed ? 'text-green-700' : 'text-amber-700'}`}>
            {overallScore}/100
          </p>
          <p className={`text-sm font-medium mt-1 ${passed ? 'text-green-600' : 'text-amber-600'}`}>
            {passed ? '✅ Obiettivi raggiunti' : '⚠️ Alcuni obiettivi non raggiunti'}
          </p>
        </div>

        {topicResults.length > 0 && (
          <div className="space-y-2 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Riepilogo argomenti</p>
            {topicResults.map(r => (
              <div
                key={r.topicId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span>{statusIcon[r.status] ?? '•'}</span>
                  <span className="text-sm text-gray-800">{r.topicLabel}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                  r.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.score}/100 — {statusLabel[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          onClick={() => window.location.href = '/'}
        >
          Torna alla home
        </Button>
      </div>
    </div>
  )
}
