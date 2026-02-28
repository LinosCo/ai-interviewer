'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import type {
  TrainingBot,
  TrainingTopicBlock,
  TraineeEducationLevel,
  TraineeCompetenceLevel,
  FailureMode,
  BotStatus,
} from '@prisma/client'

type BotWithTopics = TrainingBot & {
  topics: TrainingTopicBlock[]
}

type Props =
  | {
      mode: 'create'
      organizationId: string
      bot?: never
    }
  | {
      mode: 'edit'
      bot: BotWithTopics
      organizationId?: never
    }

interface TopicDraft {
  id?: string
  label: string
  description: string
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
      {children}
    </h3>
  )
}

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const selectCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const textareaCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y min-h-[80px]'

export default function TrainingBotConfigForm({ mode, bot, organizationId }: Props) {
  const router = useRouter()

  // Identity
  const [name, setName] = useState(bot?.name ?? '')
  const [slug, setSlug] = useState(bot?.slug ?? '')
  const [language, setLanguage] = useState(bot?.language ?? 'it')
  const [tone, setTone] = useState(bot?.tone ?? 'professional')
  const [introMessage, setIntroMessage] = useState(bot?.introMessage ?? '')

  // Obiettivo formativo
  const [learningGoal, setLearningGoal] = useState(bot?.learningGoal ?? '')
  const [targetAudience, setTargetAudience] = useState(bot?.targetAudience ?? '')

  // Profilo Trainee
  const [traineeEducationLevel, setTraineeEducationLevel] = useState<TraineeEducationLevel>(
    bot?.traineeEducationLevel ?? 'PROFESSIONAL'
  )
  const [traineeCompetenceLevel, setTraineeCompetenceLevel] = useState<TraineeCompetenceLevel>(
    bot?.traineeCompetenceLevel ?? 'INTERMEDIATE'
  )

  // Valutazione
  const [failureMode, setFailureMode] = useState<FailureMode>(bot?.failureMode ?? 'PERMISSIVE')
  const [passScoreThreshold, setPassScoreThreshold] = useState(bot?.passScoreThreshold ?? 70)
  const [maxRetries, setMaxRetries] = useState(bot?.maxRetries ?? 1)

  // Topics
  const [topics, setTopics] = useState<TopicDraft[]>(
    bot?.topics.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description ?? '',
    })) ?? []
  )

  // Branding
  const [primaryColor, setPrimaryColor] = useState(bot?.primaryColor ?? '#4f46e5')
  const [logoUrl, setLogoUrl] = useState(bot?.logoUrl ?? '')

  // Pubblicazione
  const [status, setStatus] = useState<BotStatus>(bot?.status ?? 'DRAFT')

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleNameChange(val: string) {
    setName(val)
    if (mode === 'create') {
      setSlug(slugify(val))
    }
  }

  function addTopic() {
    setTopics((prev) => [...prev, { label: '', description: '' }])
  }

  function removeTopic(idx: number) {
    setTopics((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateTopic(idx: number, field: keyof TopicDraft, value: string) {
    setTopics((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validate slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Lo slug può contenere solo lettere minuscole, numeri e trattini.')
      return
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      language,
      tone: tone.trim(),
      introMessage: introMessage.trim() || null,
      learningGoal: learningGoal.trim() || null,
      targetAudience: targetAudience.trim() || null,
      traineeEducationLevel,
      traineeCompetenceLevel,
      failureMode,
      passScoreThreshold: Number(passScoreThreshold),
      maxRetries: Number(maxRetries),
      topics: topics
        .filter((t) => t.label.trim())
        .map((t, idx) => ({
          id: t.id,
          label: t.label.trim(),
          description: t.description.trim() || null,
          orderIndex: idx,
        })),
      primaryColor: primaryColor || null,
      logoUrl: logoUrl.trim() || null,
      status,
      ...(mode === 'create' ? { organizationId } : {}),
    }

    setSaving(true)
    try {
      const url =
        mode === 'create' ? '/api/training-bots' : `/api/training-bots/${bot.id}`

      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `Errore ${res.status}`)
      }

      if (mode === 'create') {
        const created = (await res.json()) as { id: string }
        router.push(`/dashboard/training/${created.id}/settings`)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Identity */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Identità</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome" required>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Es. Formazione Sicurezza"
              className={inputCls}
              required
            />
          </Field>

          <Field
            label="Slug"
            required
            hint="Solo lettere minuscole, numeri e trattini. Es: formazione-sicurezza"
          >
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="formazione-sicurezza"
              pattern="^[a-z0-9-]+$"
              className={inputCls}
              required
            />
          </Field>

          <Field label="Lingua">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectCls}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </Field>

          <Field label="Tono" hint="Es: professionale, amichevole, formale">
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="professional"
              className={inputCls}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Messaggio introduttivo">
              <textarea
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Ciao! Benvenuto nel percorso formativo. Iniziamo insieme..."
                className={textareaCls}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* 2. Obiettivo formativo */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Obiettivo Formativo</SectionTitle>
        <div className="space-y-4">
          <Field label="Obiettivo di apprendimento">
            <textarea
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              placeholder="Descrivere l'obiettivo principale del percorso formativo..."
              className={textareaCls}
            />
          </Field>

          <Field label="Target audience">
            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Descrivere il pubblico di destinazione..."
              className={textareaCls}
            />
          </Field>
        </div>
      </div>

      {/* 3. Profilo Trainee */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Profilo Trainee</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Livello di istruzione">
            <select
              value={traineeEducationLevel}
              onChange={(e) => setTraineeEducationLevel(e.target.value as TraineeEducationLevel)}
              className={selectCls}
            >
              <option value="PRIMARY">Elementare</option>
              <option value="SECONDARY">Superiore</option>
              <option value="UNIVERSITY">Universitario</option>
              <option value="PROFESSIONAL">Professionale</option>
            </select>
          </Field>

          <Field label="Livello di competenza">
            <select
              value={traineeCompetenceLevel}
              onChange={(e) => setTraineeCompetenceLevel(e.target.value as TraineeCompetenceLevel)}
              className={selectCls}
            >
              <option value="BEGINNER">Principiante</option>
              <option value="INTERMEDIATE">Intermedio</option>
              <option value="ADVANCED">Avanzato</option>
              <option value="EXPERT">Esperto</option>
            </select>
          </Field>
        </div>
      </div>

      {/* 4. Valutazione */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Valutazione</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Modalità di fallimento">
            <select
              value={failureMode}
              onChange={(e) => setFailureMode(e.target.value as FailureMode)}
              className={selectCls}
            >
              <option value="PERMISSIVE">Permissiva</option>
              <option value="STRICT">Rigorosa</option>
            </select>
          </Field>

          <Field label="Soglia di superamento (%)" hint="0–100">
            <input
              type="number"
              value={passScoreThreshold}
              onChange={(e) => setPassScoreThreshold(Number(e.target.value))}
              min={0}
              max={100}
              className={inputCls}
            />
          </Field>

          <Field label="Tentativi massimi" hint="0–5">
            <input
              type="number"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              min={0}
              max={5}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* 5. Argomenti */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Argomenti</SectionTitle>
          <button
            type="button"
            onClick={addTopic}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Aggiungi argomento
          </button>
        </div>

        {topics.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-400 text-sm">
              Nessun argomento aggiunto. Clicca su "Aggiungi argomento" per iniziare.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic, idx) => (
              <div
                key={topic.id ?? idx}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase">
                    Argomento {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTopic(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <Field label="Titolo" required>
                  <input
                    type="text"
                    value={topic.label}
                    onChange={(e) => updateTopic(idx, 'label', e.target.value)}
                    placeholder="Es. Sicurezza sul lavoro"
                    className={inputCls}
                    required
                  />
                </Field>

                <Field label="Descrizione">
                  <textarea
                    value={topic.description}
                    onChange={(e) => updateTopic(idx, 'description', e.target.value)}
                    placeholder="Descrivi brevemente questo argomento..."
                    className={textareaCls}
                    style={{ minHeight: '60px' }}
                  />
                </Field>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Branding */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Branding</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Colore primario">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-14 border border-gray-200 rounded cursor-pointer p-1"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#4f46e5"
                className={inputCls}
              />
            </div>
          </Field>

          <Field label="URL logo" hint="URL pubblico dell'immagine">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* 7. Pubblicazione */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionTitle>Pubblicazione</SectionTitle>
        <Field label="Stato">
          <select value={status} onChange={(e) => setStatus(e.target.value as BotStatus)} className={selectCls}>
            <option value="DRAFT">Bozza</option>
            <option value="PUBLISHED">Pubblicato</option>
            <option value="ARCHIVED">Archiviato</option>
          </select>
        </Field>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="flex-shrink-0 mt-0.5">⚠</span>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <span>✓</span>
          Modifiche salvate con successo.
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors text-sm"
        >
          {saving
            ? 'Salvataggio...'
            : mode === 'create'
              ? 'Crea percorso'
              : 'Salva modifiche'}
        </button>
      </div>
    </form>
  )
}
