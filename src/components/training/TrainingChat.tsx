'use client'
import { useState, useRef, useEffect } from 'react'
import TrainingProgressBar from './TrainingProgressBar'
import QuizRenderer from './QuizRenderer'
import TrainingCompletionScreen from './TrainingCompletionScreen'
import type { TopicResult, QuizQuestion, TrainingChatResponse } from '@/lib/training/training-types'

interface Message { role: 'user' | 'assistant'; content: string; phase?: string }
interface Topic { id: string; label: string }

interface Props {
  sessionId: string
  botName: string
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
  primaryColor: string
  initialMessages: Message[]
  introMessage: string
}

function safeColor(color: string, fallback = '#6366f1'): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}

export default function TrainingChat({
  sessionId, botName, topics, currentTopicIndex: initialTopicIndex,
  topicResults: initialResults, primaryColor, initialMessages, introMessage,
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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        if (data.overallScore !== undefined && data.passed !== undefined) {
          setCompletionData({ overallScore: data.overallScore, passed: data.passed })
        }
      }

      // Advance topic index when a new EXPLAINING phase starts (not on initial load)
      if (data.phase === 'EXPLAINING' && !data.sessionComplete && messages.length > 0) {
        setCurrentTopicIndex(prev => Math.min(prev + 1, topics.length - 1))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleQuizSubmit(selectedIndexes: number[]) {
    sendMessage(JSON.stringify(selectedIndexes))
  }

  if (sessionComplete && completionData) {
    return (
      <TrainingCompletionScreen
        botName={botName}
        overallScore={completionData.overallScore}
        passed={completionData.passed}
        topicResults={topicResults}
        primaryColor={primaryColor}
      />
    )
  }

  const safeBtn = safeColor(primaryColor)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <h1 className="font-semibold text-gray-900 text-sm">{botName}</h1>
      </div>

      {/* Progress bar */}
      <TrainingProgressBar
        topics={topics}
        currentTopicIndex={currentTopicIndex}
        topicResults={topicResults}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pendingQuizzes && pendingQuizzes.length > 0 && (
          <QuizRenderer
            questions={pendingQuizzes}
            onSubmit={handleQuizSubmit}
            disabled={loading}
          />
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <span className="text-gray-400 text-sm animate-pulse">...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area — hidden during quiz */}
      {!pendingQuizzes && (
        <div className="bg-white border-t px-4 py-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Scrivi un messaggio..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: safeBtn }}
          >
            Invia
          </button>
        </div>
      )}
    </div>
  )
}
