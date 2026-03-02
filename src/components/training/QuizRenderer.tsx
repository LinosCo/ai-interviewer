'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { QuizQuestion } from '@/lib/training/training-types'

interface Props {
  questions: QuizQuestion[]
  onSubmit: (answers: Array<number | string>) => void  // number for MC/TF, string for OPEN_ANSWER
  disabled?: boolean
}

export default function QuizRenderer({ questions, onSubmit, disabled }: Props) {
  const [answers, setAnswers] = useState<Array<number | string | null>>(
    new Array(questions.length).fill(null)
  )

  const allAnswered = answers.every((a) => a !== null && a !== '')

  function selectChoice(questionIdx: number, optionIdx: number) {
    if (disabled) return
    const updated = [...answers]
    updated[questionIdx] = optionIdx
    setAnswers(updated)
  }

  function setOpenAnswer(questionIdx: number, text: string) {
    if (disabled) return
    const updated = [...answers]
    updated[questionIdx] = text
    setAnswers(updated)
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return
    onSubmit(answers as Array<number | string>)
  }

  return (
    <div className="space-y-4 my-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-medium text-gray-800 mb-3">{qi + 1}. {q.question}</p>

          {q.type === 'OPEN_ANSWER' ? (
            <textarea
              className="w-full text-sm px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 resize-none min-h-[80px] text-gray-700 placeholder:text-gray-400"
              placeholder="Scrivi la tua risposta..."
              value={typeof answers[qi] === 'string' ? (answers[qi] as string) : ''}
              onChange={(e) => setOpenAnswer(qi, e.target.value)}
              disabled={disabled}
            />
          ) : (
            <div className="space-y-2">
              {(q.options ?? []).map((opt, oi) => (
                <button
                  key={`${q.id}-${oi}`}
                  onClick={() => selectChoice(qi, oi)}
                  className={`w-full text-left text-sm px-4 py-2 rounded-lg border transition-colors ${
                    answers[qi] === oi
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <Button onClick={handleSubmit} disabled={!allAnswered || disabled} className="w-full">
        Conferma risposte
      </Button>
    </div>
  )
}
