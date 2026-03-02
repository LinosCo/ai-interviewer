// src/components/training/admin/TrainingKnowledgePanel.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { Trash2, Upload, AlertCircle } from 'lucide-react'

interface KBSource {
  id: string
  title: string | null
  type: string
  charCount: number
  createdAt: string
}

interface Props {
  botId: string
}

type InputMode = 'file' | 'text' | 'url'

const TYPE_BADGE: Record<string, string> = {
  file: 'bg-blue-50 text-blue-700 border-blue-200',
  text: 'bg-purple-50 text-purple-700 border-purple-200',
  url: 'bg-green-50 text-green-700 border-green-200',
}

export default function TrainingKnowledgePanel({ botId }: Props) {
  const [sources, setSources] = useState<KBSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<InputMode>('file')

  // Text paste fields
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  // URL field
  const [url, setUrl] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchSources() {
    try {
      const res = await fetch(`/api/training-bots/${botId}/knowledge`)
      if (!res.ok) throw new Error('Errore nel caricamento delle fonti')
      const data = await res.json()
      setSources(data.sources)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSources() }, [botId])

  async function handleFileUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const text = await file.text()
      await postSource({ type: 'file', title: file.name, content: text })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento')
    } finally {
      setUploading(false)
    }
  }

  async function postSource(body: object) {
    const res = await fetch(`/api/training-bots/${botId}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Errore nel salvataggio')
    }
    await fetchSources()
  }

  async function handleTextSubmit() {
    if (!textTitle.trim() || !textContent.trim()) return
    setUploading(true)
    setError(null)
    try {
      await postSource({ type: 'text', title: textTitle.trim(), content: textContent.trim() })
      setTextTitle('')
      setTextContent('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio')
    } finally {
      setUploading(false)
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) return
    setUploading(true)
    setError(null)
    try {
      await postSource({ type: 'url', url: url.trim() })
      setUrl('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento URL')
    } finally {
      setUploading(false)
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Eliminare questa fonte di conoscenza?')) return
    try {
      const res = await fetch(`/api/training-bots/${botId}/knowledge/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore nella eliminazione')
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore nella eliminazione')
    }
  }

  function formatChars(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k caratteri` : `${n} caratteri`
  }

  return (
    <div className="space-y-6">
      {/* Source list */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Fonti caricate</h4>
        {loading ? (
          <p className="text-sm text-gray-400">Caricamento...</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessuna fonte ancora. Aggiungi contenuti qui sotto.</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_BADGE[s.type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {s.type}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate">{s.title ?? '(senza titolo)'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatChars(s.charCount)}</span>
                <button
                  onClick={() => deleteSource(s.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Mode tabs */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Aggiungi fonte</h4>
        <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-lg w-fit">
          {([['file', 'Carica file'], ['text', 'Incolla testo'], ['url', 'Aggiungi URL']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'file' && (
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
          >
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Trascina un file qui o <span className="text-indigo-600 font-medium">sfoglia</span></p>
            <p className="text-xs text-gray-400 mt-1">Supportati: .txt, .md</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
            />
          </div>
        )}

        {mode === 'text' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Titolo della fonte (es. 'Manuale HR 2025')"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
            <textarea
              placeholder="Incolla qui il contenuto della knowledge base..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none min-h-[120px]"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textTitle.trim() || !textContent.trim() || uploading}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {uploading ? 'Salvataggio...' : 'Salva testo'}
            </button>
          </div>
        )}

        {mode === 'url' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://esempio.com/pagina-da-aggiungere"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim() || uploading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                {uploading ? '...' : 'Scarica'}
              </button>
            </div>
            <p className="text-xs text-gray-400">Il contenuto della pagina verrà estratto automaticamente.</p>
          </div>
        )}
      </div>

      {uploading && (
        <p className="text-sm text-indigo-600">Elaborazione in corso...</p>
      )}
    </div>
  )
}
