'use client'
import type { TopicResult } from '@/lib/training/training-types'

interface Topic { id: string; label: string }
interface Props {
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
}

const statusIcon: Record<string, string> = {
  PASSED: '✅',
  FAILED: '❌',
  GAP_DETECTED: '⚠️',
}

export default function TrainingProgressBar({ topics, currentTopicIndex, topicResults }: Props) {
  const resultsMap = Object.fromEntries(topicResults.map(r => [r.topicId, r]))

  return (
    <div className="flex gap-2 flex-wrap items-center justify-center px-4 py-3 border-b bg-white">
      {topics.map((topic, i) => {
        const result = resultsMap[topic.id]
        const isCurrent = i === currentTopicIndex
        const isDone = i < currentTopicIndex || !!result

        return (
          <div
            key={topic.id}
            title={topic.label}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
              isCurrent
                ? 'bg-indigo-100 border-indigo-400 text-indigo-700 font-medium'
                : isDone
                ? 'bg-gray-100 border-gray-300 text-gray-600'
                : 'border-gray-200 text-gray-400'
            }`}
          >
            {result ? (
              <>
                <span aria-hidden="true">{statusIcon[result.status] ?? '○'}</span>
                <span className="sr-only">
                  {result.status === 'PASSED' ? 'Superato' : result.status === 'FAILED' ? 'Non superato' : 'Lacune rilevate'}
                </span>
              </>
            ) : isCurrent ? (
              <>
                <span aria-hidden="true">🔄</span>
                <span className="sr-only">In corso</span>
              </>
            ) : (
              <span aria-hidden="true">○</span>
            )}
            <span className="hidden sm:inline max-w-[80px] truncate">{topic.label}</span>
            <span className="sm:hidden">{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
