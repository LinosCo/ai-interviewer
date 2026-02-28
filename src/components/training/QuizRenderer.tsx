'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { QuizQuestion } from '@/lib/training/training-types'

interface Props {
  questions: QuizQuestion[]
  onSubmit: (selectedIndexes: number[]) => void
  disabled?: boolean
}

export default function QuizRenderer({ questions, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<(number | null)[]>(new Array(questions.length).fill(null))

  const allAnswered = selected.every(s => s !== null)

  function select(questionIdx: number, optionIdx: number) {
    if (disabled) return
    const updated = [...selected]
    updated[questionIdx] = optionIdx
    setSelected(updated)
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return
    onSubmit(selected as number[])
  }

  return (
    <div className="space-y-4 my-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-800 mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <button
                key={`${q.id}-${oi}`}
                onClick={() => select(qi, oi)}
                className={`w-full text-left text-sm px-4 py-2 rounded-lg border transition-colors ${
                  selected[qi] === oi
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={!allAnswered || disabled} className="w-full">
        Conferma risposte
      </Button>
    </div>
  )
}
