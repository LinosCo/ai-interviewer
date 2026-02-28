'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookOpen, Clock } from 'lucide-react'

interface Props {
  botId: string
  botName: string
  description: string
  learningGoal: string
  topics: { id: string; label: string }[]
  estimatedMinutes: number
  welcomeTitle: string
  welcomeSubtitle: string
  primaryColor: string
  logoUrl: string
}

function safeColor(color: string, fallback = '#6366f1'): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}

export default function TrainingLandingClient({
  botId,
  botName,
  description,
  learningGoal,
  topics,
  estimatedMinutes,
  welcomeTitle,
  welcomeSubtitle,
  primaryColor,
  logoUrl,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startTraining() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/training-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Errore durante l'avvio")
        return
      }
      const { sessionId } = await res.json()
      router.push(`/t/chat/${sessionId}`)
    } catch {
      setError('Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        {logoUrl && (
          <img src={logoUrl} alt={botName} className="h-12 mb-6 object-contain" />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{welcomeTitle}</h1>
        {welcomeSubtitle && (
          <p className="text-gray-500 mb-4">{welcomeSubtitle}</p>
        )}
        {description && (
          <p className="text-gray-700 mb-4">{description}</p>
        )}
        {learningGoal && (
          <div className="bg-indigo-50 rounded-lg p-4 mb-4 flex gap-3">
            <BookOpen className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <div>
              <p className="text-sm font-medium text-indigo-700">Obiettivo formativo</p>
              <p className="text-sm text-indigo-900 mt-1">{learningGoal}</p>
            </div>
          </div>
        )}
        {topics.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Argomenti ({topics.length})
            </p>
            <ul className="space-y-1">
              {topics.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  {t.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Clock size={14} />
          <span>Durata stimata: ~{estimatedMinutes} minuti</span>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>
        )}
        <Button
          onClick={startTraining}
          disabled={loading}
          className="w-full"
          style={{ backgroundColor: safeColor(primaryColor) }}
        >
          {loading ? 'Avvio...' : 'Inizia la formazione'}
        </Button>
      </div>
    </div>
  )
}
