'use client';

import { useState } from 'react';
import { Bot, PlanType } from '@prisma/client';
import { Save, Lock, Layout, Image as ImageIcon, Video, Type, AlignLeft } from 'lucide-react';
import { colors, gradients, shadows } from '@/lib/design-system';
import { useRouter } from 'next/navigation';

interface LandingPageEditorProps {
    bot: Bot;
    plan: PlanType;
}

export default function LandingPageEditor({ bot, plan }: LandingPageEditorProps) {
    const router = useRouter();
    const isPro = plan === 'PRO' || plan === 'BUSINESS' || plan === 'TRIAL';
    const [saving, setSaving] = useState(false);

    // Local state for fields
    const [landingTitle, setLandingTitle] = useState(bot.landingTitle || bot.name || '');
    const [landingDescription, setLandingDescription] = useState(bot.landingDescription || bot.introMessage || '');
    const [landingImageUrl, setLandingImageUrl] = useState(bot.landingImageUrl || '');
    const [landingVideoUrl, setLandingVideoUrl] = useState(bot.landingVideoUrl || '');

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/bots/${bot.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    landingTitle,
                    landingDescription,
                    landingImageUrl,
                    landingVideoUrl
                })
            });
            if (res.ok) {
                router.refresh();
                // Show success toast (simulated)
                alert('Landing page aggiornata!');
            } else {
                alert('Errore nel salvataggio');
            }
        } catch (e) {
            console.error(e);
            alert('Errore di connessione');
        } finally {
            setSaving(false);
        }
    };

    if (!isPro) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 max-w-sm border border-amber-100">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Funzionalità Pro</h3>
                        <p className="text-gray-500 text-sm">Passa a Pro o Business per personalizzare completamente la Landing Page della tua intervista con logo, colori e video.</p>
                        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition-colors">
                            Vedi Piani
                        </button>
                    </div>
                </div>
                {/* Blurred mockup content behind */}
                <div className="opacity-50 filter blur-sm pointer-events-none select-none flex flex-col gap-4 text-left">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-10 bg-white border border-gray-200 rounded-lg"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4 mt-2"></div>
                    <div className="h-24 bg-white border border-gray-200 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800">
                    <Layout className="w-5 h-5 text-amber-500" />
                    <h2 className="font-bold text-lg">Personalizza Landing Page</h2>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                    {saving ? 'Salvataggio...' : <><Save className="w-4 h-4" /> Salva modifiche</>}
                </button>
            </div>

            <div className="p-6 space-y-6">

                {/* Title */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Type className="w-4 h-4 text-gray-400" />
                        Titolo Principale
                    </label>
                    <input
                        type="text"
                        value={landingTitle}
                        onChange={(e) => setLandingTitle(e.target.value)}
                        placeholder={bot.name}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                    <p className="text-xs text-gray-400">Il titolo grande mostrato all'inizio. Se vuoto, usa il nome del bot.</p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <AlignLeft className="w-4 h-4 text-gray-400" />
                        Descrizione / Sottotitolo
                    </label>
                    <textarea
                        value={landingDescription}
                        onChange={(e) => setLandingDescription(e.target.value)}
                        placeholder={bot.introMessage || bot.researchGoal || ''}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                    />
                    <p className="text-xs text-gray-400">Spiega ai partecipanti di cosa tratta l'intervista.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Image URL */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                            Immagine di Copertina (URL)
                        </label>
                        <input
                            type="url"
                            value={landingImageUrl}
                            onChange={(e) => setLandingImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                    </div>

                    {/* Video URL */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Video className="w-4 h-4 text-gray-400" />
                            Video Embed (YouTube/Vimeo)
                        </label>
                        <input
                            type="url"
                            value={landingVideoUrl}
                            onChange={(e) => setLandingVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                    </div>
                </div>

                {/* Preview Tip */}
                <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>Anteprima:</strong> Le modifiche saranno visibili immediatamente sulla pagina pubblica dell'intervista.
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple Info Icon (if not imported)
function Info({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
