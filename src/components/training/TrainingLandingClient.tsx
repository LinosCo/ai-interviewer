'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, Clock, Loader2, Lock } from 'lucide-react'
import { TRAINING_UI } from './training-ui-tokens'

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
  const brandColor = safeColor(primaryColor)

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
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-white">
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
        <div
          className="absolute top-[-10%] left-[-10%] w-[42%] h-[42%] rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, ${brandColor}40 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[42%] h-[42%] rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, ${brandColor}22 0%, transparent 70%)` }}
        />
      </div>

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto p-6 md:p-12 flex flex-col items-center text-center gap-10">
        <header className="w-full flex justify-center mt-2">
          {logoUrl ? (
            <img src={logoUrl} alt={botName} className="h-20 md:h-24 object-contain" />
          ) : (
            <div className="w-16 h-16 rounded-full text-white flex items-center justify-center shadow-lg" style={{ background: brandColor }}>
              <BookOpen size={28} />
            </div>
          )}
        </header>

        <article className="w-full space-y-8 max-w-3xl">
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: brandColor }}>
              <span className="px-3 py-1 rounded-full border border-current bg-white/50 backdrop-blur-sm">
                Percorso Formativo
              </span>
              <span className="opacity-30">•</span>
              <span>{estimatedMinutes} min stimati</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-[1.08]">
              {welcomeTitle}
            </h1>
            {welcomeSubtitle && <p className="text-lg text-gray-500 font-medium">{welcomeSubtitle}</p>}
            {description && <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">{description}</p>}
          </div>

          {learningGoal && (
            <div className="rounded-2xl p-5 flex gap-3 text-left border" style={{ background: `${brandColor}12`, borderColor: `${brandColor}33` }}>
              <BookOpen className="shrink-0 mt-0.5" size={17} style={{ color: brandColor }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: brandColor }}>Obiettivo formativo</p>
                <p className="text-sm text-gray-700 mt-1">{learningGoal}</p>
              </div>
            </div>
          )}

          {topics.length > 0 && (
            <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-stone-200 p-5 text-left shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">Argomenti ({topics.length})</p>
              <ul className="space-y-2">
                {topics.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-stone-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="line-clamp-1">{t.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="w-full max-w-lg mx-auto space-y-5">
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button
              onClick={startTraining}
              disabled={loading}
              className={`w-full group inline-flex items-center justify-center px-10 py-5 text-white font-black text-xl rounded-2xl shadow-xl transform disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] ${TRAINING_UI.motion.base} ${TRAINING_UI.ring.focus}`}
              style={{
                background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)`,
                boxShadow: `0 20px 40px -15px ${brandColor}70`,
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-3">{TRAINING_UI.copy.landingLoading}</span>
                </>
              ) : (
                <>
                  <span>{TRAINING_UI.copy.landingCta}</span>
                  <ArrowRight className="ml-3 w-6 h-6 transition-transform group-hover:translate-x-1.5" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-8 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span>~{estimatedMinutes} minuti</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" style={{ color: brandColor }} />
                <span>Sessione sicura</span>
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
