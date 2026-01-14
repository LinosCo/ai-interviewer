'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { KnowledgeManager } from '@/components/chatbot/KnowledgeManager';
import ChatWindow from '@/components/chatbot/ChatWindow';
import {
    Bot, Zap, LayoutTemplate, Save, MessageSquare, Shield,
    Palette, BookOpen, ExternalLink, RefreshCw, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatbotSettingsProps {
    bot: any;
    canUseKnowledgeBase: boolean;
}

const TABS = [
    { id: 'general', label: 'Generale', icon: Bot },
    { id: 'knowledge', label: 'Conoscenza', icon: BookOpen },
    { id: 'behavior', label: 'Comportamento', icon: Shield }, // Boundaries & Fallback
    { id: 'leads', label: 'Lead Gen', icon: Zap },
    { id: 'appearance', label: 'Aspetto', icon: Palette },
];

export default function ChatbotSettings({ bot, canUseKnowledgeBase }: ChatbotSettingsProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('general');
    const [config, setConfig] = useState({
        name: bot.name,
        tone: bot.tone || '',
        welcomeMessage: bot.introMessage || '',
        leadCaptureStrategy: bot.leadCaptureStrategy || 'after_3_msgs',
        fallbackMessage: bot.fallbackMessage || '',
        candidateDataFields: (bot.candidateDataFields as any[]) || [],
        primaryColor: bot.primaryColor || '#7C3AED', // Add color support
        boundaries: (bot.boundaries as string[]) || [],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(true); // Toggle for mobile maybe

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
                    boundaries: config.boundaries,
                    // primaryColor: config.primaryColor, // Ensure backend supports this field
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
        <div className="flex flex-col h-[calc(100vh-100px)] lg:flex-row gap-6">
            {/* Left Sidebar / Tabs - Mobile: Top Bar */}
            <div className="lg:w-64 flex-shrink-0 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 border-b lg:border-none border-gray-200">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${isActive
                                ? 'bg-purple-100 text-purple-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 overflow-hidden relative">
                {/* Form Area */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-24 lg:pb-0 scrollbar-hide">
                    <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 py-4 border-b border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900">
                            {TABS.find(t => t.id === activeTab)?.label}
                        </h2>
                        <div className="flex gap-2">
                            {/* Mobile Preview Toggle */}
                            <Button
                                variant="outline"
                                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                                className="xl:hidden"
                            >
                                {isPreviewOpen ? 'Nascondi Preview' : 'Vedi Preview'}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => window.open(`/dashboard/bots/${bot.id}/embed`)}
                                className="hidden sm:flex"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Widget
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {isSaving ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salva
                            </Button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {activeTab === 'general' && (
                                <section className="space-y-6">
                                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Assistente</label>
                                            <input
                                                type="text"
                                                value={config.name}
                                                onChange={e => setConfig({ ...config, name: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tono di Voce</label>
                                            <input
                                                type="text"
                                                value={config.tone}
                                                onChange={e => setConfig({ ...config, tone: e.target.value })}
                                                placeholder="Es. Professionale, Amichevole"
                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio di Benvenuto</label>
                                            <textarea
                                                value={config.welcomeMessage}
                                                onChange={e => setConfig({ ...config, welcomeMessage: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg h-24 resize-none focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeTab === 'knowledge' && (
                                <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
                            )}

                            {activeTab === 'behavior' && (
                                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio di Fallback</label>
                                        <p className="text-sm text-gray-500 mb-2">Cosa dire quando il bot non sa la risposta.</p>
                                        <textarea
                                            value={config.fallbackMessage}
                                            onChange={e => setConfig({ ...config, fallbackMessage: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded-lg h-24 focus:ring-2 focus:ring-purple-500 outline-none"
                                        />
                                    </div>
                                    {/* Boundaries could go here as a list editor */}
                                </section>
                            )}

                            {activeTab === 'leads' && (
                                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
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
                                            <option value="on_exit">All'uscita (Exit Intent)</option>
                                        </select>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Campi da raccogliere</label>
                                        <div className="space-y-3">
                                            {[
                                                { field: 'name', question: 'Come ti chiami?' },
                                                { field: 'email', question: 'Qual è la tua email?' },
                                                { field: 'phone', question: 'Qual è il tuo numero di telefono?' },
                                                { field: 'company', question: 'Per quale azienda lavori?' },
                                                { field: 'location', question: 'Da dove ci scrivi?' },
                                                { field: 'role', question: 'Qual è il tuo ruolo?' },
                                                { field: 'portfolio', question: 'Hai un portfolio/sito?' },
                                                { field: 'availability', question: 'Disponibilità?' },
                                                { field: 'userMessage', question: 'Lasciare un messaggio/domanda?' }
                                            ].map(field => {
                                                const isSelected = config.candidateDataFields.some((f: any) => f.field === field.field);
                                                return (
                                                    <div key={field.field} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium capitalize">{field.field}</span>
                                                            <span className="text-xs text-gray-500">{field.question}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setConfig({
                                                                                ...config,
                                                                                candidateDataFields: [...config.candidateDataFields, { field: field.field, required: true }]
                                                                            });
                                                                        } else {
                                                                            setConfig({
                                                                                ...config,
                                                                                candidateDataFields: config.candidateDataFields.filter((f: any) => f.field !== field.field)
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                                                />
                                                                <span className="text-sm font-medium text-gray-700">Abilita</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeTab === 'appearance' && (
                                <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Colore Primario</label>
                                        <div className="flex gap-2 mt-2">
                                            {['#7C3AED', '#2563EB', '#DB2777', '#EA580C', '#16A34A', '#000000'].map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setConfig({ ...config, primaryColor: color })}
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${config.primaryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                            <input
                                                type="color"
                                                value={config.primaryColor}
                                                onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                                className="w-8 h-8 rounded-full overflow-hidden cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    {/* Position etc */}
                                </section>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Live Preview Panel */}
                <div className={`w-[400px] flex-shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col transition-all duration-300 ${isPreviewOpen ? 'translate-x-0' : 'translate-x-full fixed right-0 h-full z-50 xl:relative xl:translate-x-0 xl:block hidden'
                    } xl:flex`}>
                    <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Live Preview</h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                                className="text-xs text-gray-500 hover:text-gray-900 underline"
                            >
                                {isPreviewOpen ? 'Mostra Bubble' : 'Mostra Finestra'}
                            </button>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Active
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 relative bg-[url('/grid.svg')] opacity-100 p-6 flex flex-col justify-end items-end overflow-hidden">
                        {/* Mock Website Background */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none bg-gradient-to-br from-gray-100 to-gray-200" />

                        {/* Two States: Open Window vs Closed Bubble */}
                        {isPreviewOpen ? (
                            <div className="relative w-full h-[600px] border border-gray-200 shadow-2xl rounded-2xl overflow-hidden bg-white transform translate-z-0 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                                {/* Header Mock */}
                                <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 text-white" style={{ backgroundColor: config.primaryColor }}>
                                    <span className="font-semibold">{config.name}</span>
                                    <Icons.X
                                        className="w-5 h-5 opacity-80 cursor-pointer"
                                        onClick={() => setIsPreviewOpen(false)}
                                    />
                                </div>

                                {/* Body Mock */}
                                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                                    <div className="flex gap-2">
                                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs shadow-sm" style={{ backgroundColor: config.primaryColor }}>
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <div className="p-3.5 rounded-2xl rounded-bl-none shadow-sm text-sm leading-relaxed bg-white text-gray-800 border border-gray-100 max-w-[85%]">
                                            {config.welcomeMessage || 'Ciao! Come posso aiutarti?'}
                                        </div>
                                    </div>
                                </div>

                                {/* Input Mock */}
                                <div className="p-4 bg-white border-t border-gray-100">
                                    <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-gray-200">
                                        <div className="flex-1 text-sm text-gray-400 pl-2">Scrivi un messaggio...</div>
                                        <div className="p-2 rounded-lg bg-gray-200 text-white">
                                            <Send className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end gap-2 animate-in fade-in zoom-in duration-300">
                                {/* Tooltip preview */}
                                <div className="bg-white px-4 py-2 rounded-lg shadow-lg mb-2 text-sm font-medium text-gray-800 border border-gray-100 whitespace-nowrap">
                                    Ciao! Serve aiuto? 👋
                                </div>

                                {/* Bubble Button */}
                                <button
                                    onClick={() => setIsPreviewOpen(true)}
                                    className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
                                    style={{ backgroundColor: config.primaryColor }}
                                >
                                    <MessageSquare className="w-7 h-7" />
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
