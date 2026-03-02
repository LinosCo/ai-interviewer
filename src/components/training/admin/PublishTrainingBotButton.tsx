'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Rocket } from 'lucide-react'

interface Props {
  botId: string
}

export default function PublishTrainingBotButton({ botId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publishNow() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/training-bots/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Errore durante la pubblicazione')
        return
      }

      router.refresh()
    } catch {
      setError('Errore di rete durante la pubblicazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={publishNow}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <Rocket className="w-4 h-4" />
        {loading ? 'Pubblicazione...' : 'Pubblica ora'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

