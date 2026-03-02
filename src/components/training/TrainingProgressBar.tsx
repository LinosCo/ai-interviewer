'use client'
import type { TopicResult } from '@/lib/training/training-types'
import { TRAINING_UI } from './training-ui-tokens'

interface Topic { id: string; label: string }
interface Props {
  topics: Topic[]
  currentTopicIndex: number
  topicResults: TopicResult[]
  brandColor?: string
}

export default function TrainingProgressBar({
  topics,
  currentTopicIndex,
  topicResults,
  brandColor = '#6366f1',
}: Props) {
  const resultsMap = Object.fromEntries(topicResults.map(r => [r.topicId, r]))

  if (topics.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-stone-100">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full w-1/4 rounded-full" style={{ background: brandColor }} />
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-stone-100 bg-white/95 backdrop-blur-sm">
      <div className="sm:hidden px-4 py-2">
        <div
          className={`mx-auto flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${TRAINING_UI.motion.base}`}
          style={{ borderColor: `${brandColor}33`, color: brandColor, background: `${brandColor}0f` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: brandColor }} />
          <span className="max-w-[170px] truncate">{topics[currentTopicIndex]?.label ?? 'Topic'}</span>
          <span className="text-gray-500">{currentTopicIndex + 1}/{topics.length}</span>
        </div>
      </div>

      <div className="hidden sm:block px-8 pt-7 pb-5">
        <div className="relative">
          <div className="absolute left-0 right-0 top-[6px] h-0.5 bg-stone-100" />
          <div className="relative flex justify-between">
            {topics.map((topic, i) => {
              const result = resultsMap[topic.id]
              const isCurrent = i === currentTopicIndex
              const isDone = i < currentTopicIndex || !!result

              return (
                <div key={topic.id} className="relative flex flex-col items-center">
                  <span
                    className={`absolute -top-7 w-24 -translate-x-1/2 left-1/2 truncate text-center text-[10px] font-bold uppercase tracking-wide ${
                      isCurrent ? '' : 'text-gray-400'
                    }`}
                    style={{ color: isCurrent ? brandColor : undefined }}
                  >
                    {topic.label}
                  </span>
                  <div
                    className={`mt-1 h-3 w-3 rounded-full border-2 ${TRAINING_UI.motion.base} ${isCurrent ? 'scale-125' : ''}`}
                    style={{
                      borderColor: isDone || isCurrent ? brandColor : '#d1d5db',
                      background: isDone ? brandColor : '#fff',
                      boxShadow: isCurrent ? `0 0 0 4px ${brandColor}1f` : undefined,
                    }}
                  />
                  {result && (
                    <span className="absolute top-4 text-[10px] font-semibold text-gray-500">
                      {Math.round(result.score)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
