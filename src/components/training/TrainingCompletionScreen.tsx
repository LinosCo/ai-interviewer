'use client'
import type { TopicResult } from '@/lib/training/training-types'
import { CheckCircle2, Trophy } from 'lucide-react'
import { TRAINING_UI } from './training-ui-tokens'

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
  const brandColor = /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '#6366f1'

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-[22px] shadow-2xl p-8 border ring-1 ring-black/5">
        <div className="text-center mb-6">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              passed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
            }`}
          >
            {passed ? <Trophy size={30} /> : <CheckCircle2 size={30} />}
          </div>
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
          <div className="space-y-2 mb-6 bg-white rounded-xl border border-stone-100 p-4">
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

        <button
          className={`w-full px-4 py-3 rounded-xl text-white font-semibold hover:opacity-90 ${TRAINING_UI.motion.fast} ${TRAINING_UI.ring.focus}`}
          style={{ background: brandColor }}
          onClick={() => window.location.href = '/'}
        >
          {TRAINING_UI.copy.completionCta}
        </button>
      </div>
    </div>
  )
}
