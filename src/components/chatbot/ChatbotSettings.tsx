'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { KnowledgeManager } from '@/components/chatbot/KnowledgeManager';
import { Bot, Zap, LayoutTemplate, Save } from 'lucide-react';

interface ChatbotSettingsProps {
    bot: any;
    canUseKnowledgeBase: boolean;
}

export default function ChatbotSettings({ bot, canUseKnowledgeBase }: ChatbotSettingsProps) {
    const router = useRouter();
    const [config, setConfig] = useState({
        name: bot.name,
        tone: bot.tone || '',
        welcomeMessage: bot.introMessage || '',
        leadCaptureStrategy: bot.leadCaptureStrategy || 'after_3_msgs',
        fallbackMessage: bot.fallbackMessage || '',
        candidateDataFields: (bot.candidateDataFields as any[]) || []
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/bots/${bot.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: config.name,
                    tone: config.tone,
                    introMessage: config.welcomeMessage,
                    leadCaptureStrategy: config.leadCaptureStrategy,
                    candidateDataFields: config.candidateDataFields,
                    fallbackMessage: config.fallbackMessage,
                    botType: 'chatbot'
                })
            });

            if (!res.ok) throw new Error('Failed to save');
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('Errore nel salvataggio');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => window.open(`/dashboard/bots/${bot.id}/embed`)}
                >
                    <Icons.Settings2 className="w-4 h-4 mr-2" />
                    Install Widget
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                    {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salva Modifiche
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Bot className="w-5 h-5 text-orange-600" />
                            Identità Chatbot
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Assistente</label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={e => setConfig({ ...config, name: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tono di Voce</label>
                                <input
                                    type="text"
                                    value={config.tone}
                                    onChange={e => setConfig({ ...config, tone: e.target.value })}
                                    placeholder="Es. Professionale, Incoraggiante, Conciso"
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio di Benvenuto</label>
                                <textarea
                                    value={config.welcomeMessage}
                                    onChange={e => setConfig({ ...config, welcomeMessage: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Icons.BookOpen className="w-5 h-5 text-blue-600" />
                            Base di Conoscenza
                        </h2>
                        {canUseKnowledgeBase ? (
                            <KnowledgeManager
                                botId={bot.id}
                                initialSources={bot.knowledgeSources}
                            />
                        ) : (
                            <div className="p-4 bg-gray-50 text-gray-500 text-sm rounded-lg">
                                Il tuo piano non supporta la Knowledge Base personalizzata.
                            </div>
                        )}
                    </section>
                </div>

                <div className="space-y-8">
                    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            Lead Generation
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Quando chiedere i dati?</label>
                                <select
                                    value={config.leadCaptureStrategy}
                                    onChange={e => setConfig({ ...config, leadCaptureStrategy: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"
                                >
                                    <option value="immediate">Subito (dopo il benvenuto)</option>
                                    <option value="after_3_msgs">Dopo 3 messaggi (Consigliato)</option>
                                    <option value="smart">Smart (Decide l'AI)</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Campi da raccogliere</label>
                                {config.candidateDataFields.length > 0 ? (
                                    config.candidateDataFields.map((field: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded mb-2 text-sm">
                                            <span className="font-medium text-gray-800">{field.field}</span>
                                            <span className="text-xs text-gray-500">{field.required ? 'Required' : 'Optional'}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic">Nessun campo configuato.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm opacity-60 pointer-events-none">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-purple-500" />
                            Aspetto Widget
                        </h2>
                        <p className="text-sm text-gray-500">
                            Personalizzazione colori e icona in arrivo.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
