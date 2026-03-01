'use client';

import { useState, useEffect, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Input } from '@/components/ui/business-tuner/Input';
import { KnowledgeManager } from '@/components/chatbot/KnowledgeManager';
import ChatWindow from '@/components/chatbot/ChatWindow';
import ProjectSelector from '@/components/dashboard/ProjectSelector';
import {
    Bot, Zap, Save, MessageSquare, Shield,
    Palette, BookOpen, RefreshCw, Send, Eye, Check, User, Mail, Phone, Building, Briefcase, MapPin, X, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple styled components
const Label = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <label className={className}>{children}</label>
);

const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ className, ...props }, ref) => (
        <textarea ref={ref} className={`w-full ${className}`} {...props} />
    )
);
Textarea.displayName = 'Textarea';

interface ChatbotSettingsProps {
    bot: any;
    canUseKnowledgeBase: boolean;
    projects: any[];
}

const TABS = [
    { id: 'general', label: 'Generale', icon: Bot },
    { id: 'knowledge', label: 'Conoscenza', icon: BookOpen },
    { id: 'behavior', label: 'Comportamento', icon: Shield }, // Boundaries & Fallback
    { id: 'leads', label: 'Lead Gen', icon: Zap },
    { id: 'appearance', label: 'Aspetto', icon: Palette },
    { id: 'test', label: 'Test & Debug', icon: MessageSquare },
];

export default function ChatbotSettings({ bot, canUseKnowledgeBase, projects }: ChatbotSettingsProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('general');
    const [config, setConfig] = useState({
        name: bot.name,
        tone: bot.tone || '',
        welcomeMessage: bot.introMessage || '',
        leadCaptureStrategy: bot.leadCaptureStrategy || 'after_3_msgs',
        fallbackMessage: bot.fallbackMessage || '',
        candidateDataFields: (bot.candidateDataFields as any[]) || [],
        primaryColor: bot.primaryColor || '#7C3AED',
        logoUrl: bot.logoUrl || '',
        boundaries: (bot.boundaries as string[]) || [],
        backgroundColor: bot.backgroundColor || '', // Ensure consistent value for hydration
        privacyPolicyUrl: bot.privacyPolicyUrl || '',
        enablePageContext: bot.enablePageContext ?? false,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(true); // Toggle for mobile maybe
    const [newBoundary, setNewBoundary] = useState('');

    const handleAddBoundary = () => {
        if (!newBoundary.trim()) return;
        setConfig({
            ...config,
            boundaries: [...config.boundaries, newBoundary.trim()]
        });
        setNewBoundary('');
    };

    const handleRemoveBoundary = (index: number) => {
        setConfig({
            ...config,
            boundaries: config.boundaries.filter((_: string, i: number) => i !== index)
        });
    };

    // Toggle global widget visibility when in Test tab
    useEffect(() => {
        if (activeTab === 'test') {
            document.body.classList.add('hide-global-widget');
        } else {
            document.body.classList.remove('hide-global-widget');
        }
        return () => {
            document.body.classList.remove('hide-global-widget');
        };
    }, [activeTab]);

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
                    primaryColor: config.primaryColor,
                    backgroundColor: config.backgroundColor,
                    logoUrl: config.logoUrl,
                    privacyPolicyUrl: config.privacyPolicyUrl,
                    enablePageContext: config.enablePageContext,
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
        <div className="flex flex-col h-[calc(100vh-120px)] gap-6 overflow-hidden">
            {/* Horizontal Tabs Navigation */}
            <div className="flex-shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-gray-200">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-t-xl transition-all duration-300 relative whitespace-nowrap font-semibold ${isActive
                                    ? 'bg-white text-blue-700 shadow-sm border-b-2 border-blue-600'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Test Tab - Full Width */}
            {activeTab === 'test' ? (
                <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden relative flex flex-col items-center justify-center p-8">
                    <div className="absolute top-4 left-4 z-10 bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full font-medium border border-yellow-200 flex items-center gap-2 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                        Modalità Test - Il widget live è nascosto
                    </div>

                    <div className="w-full max-w-md h-[600px] shadow-2xl rounded-2xl overflow-hidden bg-white border border-gray-300 relative">
                        <iframe
                            src={`/w/${bot.id}?full=true`}
                            className="w-full h-full border-none"
                            title="Bot Preview"
                        />
                    </div>
                </div>
            ) : (
                /* Standard Layout for other tabs */
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* Form Area */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                        {/* Save Button - Sticky */}
                        <div className="flex justify-end items-center sticky top-0 bg-white/90 backdrop-blur-md z-20 py-3 -mx-2 px-2">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                                    className="xl:hidden rounded-full font-bold border-gray-200"
                                >
                                    <Eye className="w-4 h-4 mr-2" /> {isPreviewOpen ? 'Nascondi' : 'Anteprima'}
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 font-bold shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                                >
                                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
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
                                className="space-y-10"
                            >
                                {activeTab === 'general' && (
                                    <div className="grid gap-10">
                                        {/* Project Selector Section */}
                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-6">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Progetto</h3>
                                                <p className="text-sm text-gray-500 font-medium">Associa questo chatbot a un progetto specifico.</p>
                                            </div>
                                            <ProjectSelector
                                                botId={bot.id}
                                                botName={bot.name}
                                                currentProjectId={bot.projectId}
                                                projects={projects}
                                            />
                                        </div>

                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Identità del Chatbot</h3>
                                                <p className="text-sm text-gray-500 font-medium">Definisci come l'assistente si presenta ai tuoi utenti.</p>
                                            </div>

                                            <div className="flex flex-col gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Nome Assistente</label>
                                                    <Input
                                                        value={config.name}
                                                        onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                                        placeholder="es. Supporto AI"
                                                        className="rounded-2xl border-gray-100 bg-gray-50/50 focus:ring-blue-500 h-12 font-medium px-4"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Tono di Voce</label>
                                                    <select
                                                        value={config.tone}
                                                        onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                                                        className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-2 focus:ring-blue-500 font-medium p-4 outline-none appearance-none"
                                                    >
                                                        <option value="professional">Professionale & Formale</option>
                                                        <option value="friendly">Amichevole & Informale</option>
                                                        <option value="enthusiastic">Entusiasta & Energico</option>
                                                        <option value="neutral">Neutro & Diretto</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Messaggio di Benvenuto</label>
                                                <textarea
                                                    value={config.welcomeMessage}
                                                    onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                                                    placeholder="Ciao! Come posso aiutarti oggi?"
                                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-2 focus:ring-blue-500 min-h-[100px] font-medium p-4 outline-none"
                                                />
                                                <p className="text-[10px] text-gray-400 font-bold italic ml-1">* Questo è il primo messaggio che l'utente vedrà quando apre la chat.</p>
                                            </div>
                                        </div>
                                    </div>
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
                                    <div className="grid gap-10">
                                        {/* Boundaries / Limits Section */}
                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Limiti e Obiettivi</h3>
                                                <p className="text-sm text-gray-500 font-medium">Definisci cosa il chatbot NON deve fare per garantire risposte appropriate.</p>
                                            </div>

                                            {/* Current Boundaries List */}
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Limiti Attivi</label>
                                                <div className="space-y-3">
                                                    {config.boundaries.length === 0 ? (
                                                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-500 italic">
                                                            Nessun limite configurato. Aggiungi limiti per controllare il comportamento del bot.
                                                        </div>
                                                    ) : (
                                                        config.boundaries.map((boundary: string, idx: number) => (
                                                            <div
                                                                key={idx}
                                                                className="flex items-start justify-between p-4 bg-red-50/50 border border-red-100 rounded-2xl group"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <Shield className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                                    <p className="text-sm text-gray-800 font-medium">{boundary}</p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemoveBoundary(idx)}
                                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Rimuovi limite"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Add New Boundary */}
                                                <div className="flex gap-3 mt-4">
                                                    <input
                                                        type="text"
                                                        value={newBoundary}
                                                        onChange={(e) => setNewBoundary(e.target.value)}
                                                        className="flex-1 rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-2 focus:ring-blue-500 h-12 font-medium px-4 outline-none"
                                                        placeholder="Es: Non discutere di politica o religione"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddBoundary()}
                                                    />
                                                    <button
                                                        onClick={handleAddBoundary}
                                                        disabled={!newBoundary.trim()}
                                                        className="px-5 h-12 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Aggiungi
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Comportamento</h3>
                                                <p className="text-sm text-gray-500 font-medium">Configura come l'assistente reagisce in situazioni specifiche.</p>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Messaggio di Fallback</label>
                                                <p className="text-xs text-gray-500 font-medium mb-2">Cosa dire quando il bot non trova una risposta nella knowledge base.</p>
                                                <textarea
                                                    value={config.fallbackMessage}
                                                    onChange={(e) => setConfig({ ...config, fallbackMessage: e.target.value })}
                                                    placeholder="Mi dispiace, ma non ho informazioni su questo. Posso aiutarti con altro?"
                                                    className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 focus:ring-2 focus:ring-blue-500 min-h-[120px] font-medium p-4 outline-none"
                                                />
                                            </div>

                                            {/* Page Context Toggle */}
                                            <div className="flex items-start gap-4 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={config.enablePageContext}
                                                    onClick={() => setConfig({ ...config, enablePageContext: !config.enablePageContext })}
                                                    className={`relative mt-0.5 flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${config.enablePageContext ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${config.enablePageContext ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">Contesto Pagina</p>
                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                        Il chatbot legge il contenuto della pagina corrente del visitatore e lo usa per risposte più contestuali. Richiede embed via <code className="bg-blue-100 px-1 rounded text-blue-700">chatbot.js</code>.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Privacy & Legal</h3>
                                                <p className="text-sm text-gray-500 font-medium">Configura i link alle policy per la conformità GDPR.</p>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">URL Privacy Policy</label>
                                                <p className="text-xs text-gray-500 font-medium mb-2">Link alla tua privacy policy. Verrà mostrato nella schermata di benvenuto del chatbot.</p>
                                                <Input
                                                    type="url"
                                                    value={config.privacyPolicyUrl}
                                                    onChange={(e) => setConfig({ ...config, privacyPolicyUrl: e.target.value })}
                                                    placeholder="https://tuosito.com/privacy-policy"
                                                    className="rounded-2xl border-gray-100 bg-gray-50/50 focus:ring-blue-500 h-12 font-medium px-4"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'leads' && (
                                    <div className="grid gap-10">
                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Lead Generation</h3>
                                                <p className="text-sm text-gray-500 font-medium">Scegli quali dati raccogliere dai tuoi utenti.</p>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Strategia di Acquisizione</label>
                                                <select
                                                    value={config.leadCaptureStrategy}
                                                    onChange={e => setConfig({ ...config, leadCaptureStrategy: e.target.value })}
                                                    className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none"
                                                >
                                                    <option value="immediate">Inizio Conversazione (Subito)</option>
                                                    <option value="after_3_msgs">Dopo 3 messaggi (Consigliato)</option>
                                                    <option value="smart">Smart (L'AI decide il momento migliore)</option>
                                                    <option value="on_exit">All'uscita (Exit Intent)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Campi da Richiedere</label>
                                                <div className="grid sm:grid-cols-2 gap-4">
                                                    {[
                                                        { field: 'name', label: 'Nome Completo', icon: 'User' },
                                                        { field: 'email', label: 'Email Aziendale', icon: 'Mail' },
                                                        { field: 'phone', label: 'Telefono', icon: 'Phone' },
                                                        { field: 'company', label: 'Azienda', icon: 'Building' },
                                                        { field: 'role', label: 'Ruolo / Posizione', icon: 'Briefcase' },
                                                        { field: 'location', label: 'Città / Area', icon: 'MapPin' }
                                                    ].map(field => {
                                                        const isSelected = config.candidateDataFields.some((f: any) => f.field === field.field);
                                                        return (
                                                            <button
                                                                key={field.field}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setConfig({
                                                                            ...config,
                                                                            candidateDataFields: config.candidateDataFields.filter((f: any) => f.field !== field.field)
                                                                        });
                                                                    } else {
                                                                        setConfig({
                                                                            ...config,
                                                                            candidateDataFields: [...config.candidateDataFields, {
                                                                                field: field.field,
                                                                                required: true,
                                                                                question: `Qual è il tuo ${field.label.toLowerCase()}?`
                                                                            }]
                                                                        });
                                                                    }
                                                                }}
                                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${isSelected
                                                                    ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
                                                                    : 'bg-white border-gray-100 hover:border-gray-200'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                                        {(() => {
                                                                            const Icon = field.field === 'name' ? User :
                                                                                field.field === 'email' ? Mail :
                                                                                    field.field === 'phone' ? Phone :
                                                                                        field.field === 'company' ? Building :
                                                                                            field.field === 'role' ? Briefcase :
                                                                                                MapPin;
                                                                            return <Icon className="w-4 h-4" />;
                                                                        })()}
                                                                    </div>
                                                                    <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{field.label}</span>
                                                                </div>
                                                                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'appearance' && (
                                    <div className="grid gap-10">
                                        <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-8">
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-gray-900">Look & Feel</h3>
                                                <p className="text-sm text-gray-500 font-medium">Personalizza l'aspetto del tuo assistente virtuale.</p>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Colore Brand</label>
                                                <div className="flex flex-wrap gap-3 mt-2">
                                                    {['#7C3AED', '#2563EB', '#DB2777', '#EA580C', '#16A34A', '#000000'].map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setConfig({ ...config, primaryColor: color })}
                                                            className={`w-10 h-10 rounded-2xl border-4 transition-all duration-300 hover:scale-110 shadow-sm ${config.primaryColor === color ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent'
                                                                }`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                    <div className="relative group">
                                                        <input
                                                            type="color"
                                                            value={config.primaryColor}
                                                            onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                                            className="w-10 h-10 rounded-2xl border-4 border-transparent appearance-none bg-gray-100 cursor-pointer transition-transform hover:scale-110"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Live Preview Panel - 40% width on desktop, full screen modal on mobile */}
                    <div className={`xl:w-[40%] xl:min-w-[400px] flex-shrink-0 bg-gray-50/50 flex flex-col transition-all duration-500 rounded-2xl overflow-hidden border border-gray-200 shadow-lg ${isPreviewOpen ? 'fixed inset-4 z-50 xl:relative xl:inset-auto' : 'hidden xl:flex'}`}>
                        <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">Anteprima Live</h3>
                                <p className="text-xs text-gray-500">Come apparirà il chatbot</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                                    className="xl:hidden p-2 rounded-full hover:bg-gray-100 text-gray-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ring-1 ring-green-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    Online
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative p-8 flex flex-col justify-end items-end overflow-hidden bg-[#fafafa]">
                            {/* Mock UI elements to make it look like a real browser/app */}
                            <div className="absolute top-10 left-10 right-10 flex gap-4 opacity-20 pointer-events-none">
                                <div className="h-4 w-1/3 bg-gray-200 rounded-full" />
                                <div className="h-4 w-1/4 bg-gray-200 rounded-full" />
                            </div>
                            <div className="absolute top-24 left-10 right-10 space-y-4 opacity-10 pointer-events-none">
                                <div className="h-32 w-full bg-gray-200 rounded-[2rem]" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-24 bg-gray-200 rounded-[2rem]" />
                                    <div className="h-24 bg-gray-200 rounded-[2rem]" />
                                </div>
                            </div>

                            {/* Two States: Open Window vs Closed Bubble */}
                            {isPreviewOpen ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="relative w-full h-full max-h-[650px] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden bg-white flex flex-col"
                                >
                                    {/* Header Mock */}
                                    <div className="h-20 flex-shrink-0 flex items-center justify-between px-6 text-white" style={{ backgroundColor: config.primaryColor }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                <Bot className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <span className="font-black text-lg block leading-none">{config.name}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Sempre Attivo</span>
                                            </div>
                                        </div>
                                        <Icons.X
                                            className="w-6 h-6 opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
                                            onClick={() => setIsPreviewOpen(false)}
                                        />
                                    </div>

                                    {/* Body Mock */}
                                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-6">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[10px] font-black shadow-sm" style={{ backgroundColor: config.primaryColor }}>
                                                {config.name?.[0] || 'A'}
                                            </div>
                                            <div className="p-4 rounded-3xl rounded-tl-none shadow-sm text-sm leading-relaxed bg-white text-gray-800 border border-gray-100 max-w-[85%] font-medium">
                                                {config.welcomeMessage || 'Ciao! Come posso aiutarti?'}
                                            </div>
                                        </div>

                                        <div className="flex flex-row-reverse gap-3">
                                            <div className="w-8 h-8 rounded-xl flex-shrink-0 bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-black">
                                                U
                                            </div>
                                            <div className="p-4 rounded-3xl rounded-tr-none shadow-sm text-sm leading-relaxed text-white max-w-[85%] font-medium" style={{ backgroundColor: config.primaryColor }}>
                                                Ciao, vorrei maggiori informazioni sui vostri servizi.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Input Mock */}
                                    <div className="p-6 bg-white border-t border-gray-100">
                                        <div className="flex gap-3 items-center bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                            <div className="flex-1 text-sm text-gray-400 pl-4 font-medium">Scrivi un messaggio...</div>
                                            <div className="p-3 rounded-xl shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.primaryColor }}>
                                                <Send className="w-4 h-4 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-end gap-4 animate-in fade-in zoom-in duration-500">
                                    {/* Tooltip preview */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-white px-5 py-3 rounded-2xl shadow-xl mb-2 text-sm font-bold text-gray-800 border border-gray-100 whitespace-nowrap relative"
                                    >
                                        Ciao! Serve aiuto? 👋
                                        <div className="absolute -bottom-1 right-6 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45" />
                                    </motion.div>

                                    {/* Bubble Button */}
                                    <button
                                        onClick={() => setIsPreviewOpen(true)}
                                        className="w-16 h-16 rounded-[1.5rem] shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-all duration-300 hover:rotate-6 active:scale-95 group"
                                        style={{ backgroundColor: config.primaryColor }}
                                    >
                                        <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
