'use client'
import { useState, useRef, useEffect } from 'react'
import { Bot, Clock3, SendHorizonal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '@/components/ui/business-tuner/Icons'
import TrainingProgressBar from './TrainingProgressBar'
import QuizRenderer from './QuizRenderer'
import TrainingCompletionScreen from './TrainingCompletionScreen'
import type { TopicResult, QuizQuestion, TrainingChatResponse } from '@/lib/training/training-types'
import { TRAINING_UI } from './training-ui-tokens'

interface Message { role: 'user' | 'assistant'; content: string; phase?: string }
interface Topic { id: string; label: string }

interface Props {
  sessionId: string
  botName: string
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
  primaryColor: string
  logoUrl?: string
  rewardConfig?: {
    enabled: boolean
    type?: string
    payload?: string
    displayText?: string | null
  } | null
  initialMessages: Message[]
  introMessage: string
}

function safeColor(color: string, fallback = '#6366f1'): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}

export default function TrainingChat({
  sessionId, botName, topics, currentTopicIndex: initialTopicIndex,
  topicResults: initialResults, primaryColor, logoUrl, initialMessages, introMessage,
  rewardConfig,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0 ? initialMessages : [{ role: 'assistant', content: introMessage }]
  )
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentTopicIndex, setCurrentTopicIndex] = useState(initialTopicIndex)
  const [topicResults, setTopicResults] = useState<TopicResult[]>(initialResults)
  const [pendingQuizzes, setPendingQuizzes] = useState<QuizQuestion[] | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [completionData, setCompletionData] = useState<{ overallScore: number; passed: boolean } | null>(null)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasSentFirstMessage = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (pendingQuizzes || loading) return
    inputRef.current?.focus()
  }, [loading, pendingQuizzes])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedMinutes(prev => prev + 1)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  async function sendMessage(messageText: string) {
    if (!messageText.trim() || loading) return
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: messageText }])
    setInput('')
    setPendingQuizzes(null)

    try {
      const res = await fetch('/api/training-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, sessionId }),
      })

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Si è verificato un errore. Riprova tra un momento.' },
        ])
        return
      }

      const data: TrainingChatResponse = await res.json()

      setMessages(prev => [...prev, { role: 'assistant', content: data.text, phase: data.phase }])

      if (data.topicResult) {
        setTopicResults(prev => {
          const idx = prev.findIndex(r => r.topicId === data.topicResult!.topicId)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = data.topicResult!
            return copy
          }
          return [...prev, data.topicResult!]
        })
      }

      if (data.quizPayload) {
        setPendingQuizzes(data.quizPayload.questions)
      }

      if (data.sessionComplete) {
        setSessionComplete(true)
        setCompletionData({
          overallScore: data.overallScore ?? 0,
          passed: data.passed ?? false,
        })
      }

      // Advance topic index when a new EXPLAINING phase starts (not on initial load)
      if (data.phase === 'EXPLAINING' && !data.sessionComplete && hasSentFirstMessage.current) {
        setCurrentTopicIndex(prev => Math.min(prev + 1, topics.length - 1))
      }
      hasSentFirstMessage.current = true
    } finally {
      setLoading(false)
      // Keep input focused across turns so user can keep typing without extra clicks
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  function handleQuizSubmit(answers: Array<number | string>) {
    sendMessage(JSON.stringify(answers))
  }

  if (sessionComplete && completionData) {
    return (
      <TrainingCompletionScreen
        sessionId={sessionId}
        botName={botName}
        overallScore={completionData.overallScore}
        passed={completionData.passed}
        topicResults={topicResults}
        primaryColor={primaryColor}
        rewardConfig={rewardConfig}
      />
    )
  }

  const safeBtn = safeColor(primaryColor)
  const latestAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') return i
    }
    return -1
  })()
  const currentAssistantMessage = latestAssistantIndex >= 0 ? messages[latestAssistantIndex] : null
  const previousUserMessage = (() => {
    if (latestAssistantIndex <= 0) return null
    for (let i = latestAssistantIndex - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') return messages[i]
    }
    return null
  })()

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-x-hidden bg-gradient-to-b from-stone-50 via-white to-stone-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `radial-gradient(circle at 80% 88%, ${safeBtn}20 0%, transparent 42%)` }}
      />

      <header className="fixed top-2 left-0 right-0 z-40 px-3 py-2 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-stone-200/70 bg-white/90 backdrop-blur-md p-2 pl-3 pr-4 shadow-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: safeBtn }}>
            <Bot size={16} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">
              Formazione AI
            </span>
            <span className="font-bold text-sm text-gray-900 truncate max-w-[170px]">{botName}</span>
          </div>
        </div>

        <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-200/70 shadow-md text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
          <Clock3 size={12} className="text-gray-400" />
          <span>{elapsedMinutes}m</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto pt-20 pb-28 px-3 sm:px-5 flex flex-col">
        <TrainingProgressBar
          topics={topics}
          currentTopicIndex={currentTopicIndex}
          topicResults={topicResults}
          brandColor={safeBtn}
        />

        <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
          {previousUserMessage && !loading && (
            <motion.div
              key={`user-${previousUserMessage.content.slice(0, 60)}`}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex justify-end pt-1"
            >
              <div className="max-w-[82%] rounded-2xl rounded-tr-md px-4 py-3 text-sm whitespace-pre-wrap shadow-sm border text-white border-transparent" style={{ background: safeBtn }}>
                <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1 font-semibold">La tua risposta</p>
                {previousUserMessage.content}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false} mode="wait">
            {currentAssistantMessage && (
              <motion.div
                key={`assistant-${currentAssistantMessage.content.slice(0, 60)}`}
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex justify-start"
              >
                <div className="max-w-[92%] rounded-2xl rounded-tl-md px-5 py-4 text-[15px] leading-relaxed shadow-md border border-stone-200 bg-white text-gray-900">
                  {currentAssistantMessage.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {pendingQuizzes && pendingQuizzes.length > 0 && (
            <QuizRenderer
              questions={pendingQuizzes}
              onSubmit={handleQuizSubmit}
              disabled={loading}
              brandColor={safeBtn}
            />
          )}

          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]" />
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{ width: 92, height: 92, border: `3px solid ${safeBtn}30` }}
                />
                <div
                  className="relative w-20 h-20 rounded-full bg-white shadow-xl border-2 flex items-center justify-center"
                  style={{ borderColor: `${safeBtn}44` }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={botName} className="w-10 h-10 object-contain" />
                  ) : (
                    <Icons.Logo size={30} style={{ color: safeBtn }} />
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {!pendingQuizzes && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white/95 to-transparent p-3 sm:p-5">
          <div className="max-w-3xl mx-auto relative">
            <div
              className="absolute -inset-1 rounded-[20px] blur opacity-20"
              style={{ background: `linear-gradient(to right, ${safeBtn}, ${safeBtn}99)` }}
            />
            <div className="relative bg-white rounded-[18px] shadow-2xl flex items-end overflow-hidden ring-1 ring-black/5">
              <textarea
                ref={inputRef}
                aria-label="Messaggio"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(input)
                  }
                }}
                rows={1}
                className={`w-full resize-none border-none bg-transparent px-4 py-4 pr-16 text-base text-gray-900 placeholder-gray-400 ${TRAINING_UI.ring.focus}`}
                disabled={loading}
                placeholder={TRAINING_UI.copy.chatPlaceholder}
                autoFocus
              />
              <div className="pb-2 pr-2">
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg disabled:opacity-50 ${TRAINING_UI.motion.fast} hover:scale-105 active:scale-95`}
                  style={{ background: safeBtn, boxShadow: `0 4px 14px 0 ${safeBtn}66` }}
                >
                  <SendHorizonal size={19} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
