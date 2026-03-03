'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
        bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">Copiato!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copia link
        </>
      )}
    </button>
  )
}
