'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Sparkles, ArrowRight, Bot } from 'lucide-react';

export default function ChatbotWizardPage() {
    const router = useRouter();
    const [goal, setGoal] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    const handleGenerate = () => {
        if (!goal.trim()) return;
        const encoded = encodeURIComponent(goal);
        router.push(`/dashboard/bots/create-chatbot/wizard/generate?goal=${encoded}`);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
            fontFamily: "'Inter', sans-serif",
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Ambient Background */}
            <div style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}40 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}25 0%, transparent 40%),
                    radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.lavender}20 0%, transparent 35%)
                `
            }} />

            {/* Simple Header */}
            <header className="px-8 py-6 relative z-10 flex justify-between items-center">
                <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => router.push('/dashboard/bots')}
                >
                    <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                        <Icons.Bot size={20} />
                    </div>
                    <span className="font-semibold text-gray-900">Chatbot AI Builder</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-6 relative z-10">
                <div className="max-w-2xl w-full">
                    <div className="text-center mb-10">
                        <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                            Crea il tuo Assistente AI
                        </h1>
                        <p className="text-xl text-gray-500 max-w-lg mx-auto">
                            Descrivi l'obiettivo del chatbot e l'AI lo configurerà automaticamente per te.
                        </p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-xl border border-orange-200 rounded-3xl p-2 shadow-2xl shadow-orange-500/5">
                        <div className="relative">
                            <textarea
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="Es: Voglio un assistente per il supporto clienti che risponda alle domande sui prezzi e raccolga i contatti dei lead B2B..."
                                className="w-full h-48 bg-transparent p-6 text-xl text-gray-800 placeholder-gray-400 focus:outline-none resize-none"
                            />

                            {/* AI Tools Bar */}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <button
                                    onClick={async () => {
                                        if (!goal.trim() || isRefining) return;
                                        setIsRefining(true);
                                        try {
                                            const res = await fetch('/api/ai/refine', {
                                                method: 'POST',
                                                body: JSON.stringify({ text: goal, fieldType: 'researchGoal' }) // Reusing refined logic
                                            });
                                            const data = await res.json();
                                            if (data.refinedText) setGoal(data.refinedText);
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setIsRefining(false);
                                        }
                                    }}
                                    disabled={!goal.trim() || isRefining}
                                    className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-sm font-medium hover:bg-orange-100 transition-colors flex items-center gap-1.5"
                                >
                                    <Sparkles size={14} className={isRefining ? 'animate-spin' : ''} />
                                    {isRefining ? 'Migliorando...' : 'Migliora con AI'}
                                </button>
                            </div>
                        </div>

                        <div className="p-2 border-t border-gray-100">
                            <button
                                onClick={handleGenerate}
                                disabled={!goal.trim()}
                                className={`w-full py-4 rounded-2xl text-white font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20
                                    ${!goal.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:scale-[1.01]'}
                                `}
                            >
                                Genera Configurazione
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Prompts */}
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        {[
                            "Supporto Clienti SaaS",
                            "Lead Gen Immobiliare",
                            "Assistente E-commerce",
                            "Booking Appuntamenti"
                        ].map((prompt, i) => (
                            <button
                                key={i}
                                onClick={() => setGoal(prompt)}
                                className="px-4 py-2 rounded-full bg-white/60 border border-orange-100 text-sm text-gray-600 hover:bg-white hover:border-orange-300 transition-all"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
