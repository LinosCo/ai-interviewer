'use client';

import { useState } from 'react';
import { Code, Copy, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/business-tuner/Button';

interface EmbedCodeSectionProps {
    botId: string;
    baseUrl: string;
    botName: string;
}

export default function EmbedCodeSection({ botId, baseUrl, botName }: EmbedCodeSectionProps) {
    const [copied, setCopied] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [options, setOptions] = useState({
        autoOpen: false,
        hideOnMobile: false,
        delayMs: 0,
    });

    const generateEmbedCode = () => {
        let attrs = `data-bot-id="${botId}"`;

        if (options.autoOpen) {
            attrs += `\n  data-auto-open="true"`;
        }
        if (options.hideOnMobile) {
            attrs += `\n  data-hide-mobile="true"`;
        }
        if (options.delayMs > 0) {
            attrs += `\n  data-delay="${options.delayMs}"`;
        }

        return `<script
  src="${baseUrl}/embed/chatbot.js"
  ${attrs}
  defer
></script>`;
    };

    const embedCode = generateEmbedCode();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-slate-700" />
                    <h2 className="text-lg font-bold text-slate-900">Codice di Integrazione</h2>
                </div>
                <Button
                    onClick={handleCopy}
                    size="sm"
                    className={`transition-all ${copied ? 'bg-green-600 hover:bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            Copiato!
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copia Codice
                        </>
                    )}
                </Button>
            </div>

            <p className="text-sm text-slate-600">
                Copia questo codice e incollalo nel tag <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs text-slate-800">&lt;head&gt;</code> o prima della chiusura del <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs text-slate-800">&lt;/body&gt;</code> del tuo sito web.
            </p>

            {/* Code Block */}
            <div className="relative group">
                <pre className="bg-slate-900 text-slate-100 p-5 rounded-xl overflow-x-auto text-sm leading-relaxed border border-slate-800 font-mono">
                    <code className="block whitespace-pre">{embedCode}</code>
                </pre>
            </div>

            {/* Advanced Options Toggle */}
            <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Opzioni Avanzate
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Auto Open */}
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={options.autoOpen}
                                onChange={(e) => setOptions({ ...options, autoOpen: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                                <span className="font-medium text-slate-800 group-hover:text-purple-700 transition-colors">Apri Automaticamente</span>
                                <p className="text-xs text-slate-500 mt-0.5">La chat si apre automaticamente al caricamento della pagina</p>
                            </div>
                        </label>

                        {/* Hide on Mobile */}
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={options.hideOnMobile}
                                onChange={(e) => setOptions({ ...options, hideOnMobile: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                                <span className="font-medium text-slate-800 group-hover:text-purple-700 transition-colors">Nascondi su Mobile</span>
                                <p className="text-xs text-slate-500 mt-0.5">Il widget non appare su dispositivi mobili</p>
                            </div>
                        </label>
                    </div>

                    {/* Delay */}
                    <div className="space-y-2">
                        <label className="block font-medium text-slate-800">
                            Ritardo Apparizione (ms)
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="0"
                                max="10000"
                                step="500"
                                value={options.delayMs}
                                onChange={(e) => setOptions({ ...options, delayMs: parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                            <span className="text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg min-w-[80px] text-center text-slate-700">
                                {options.delayMs === 0 ? 'Subito' : `${options.delayMs / 1000}s`}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">Tempo di attesa prima che il widget appaia sulla pagina</p>
                    </div>
                </div>
            )}
        </div>
    );
}
