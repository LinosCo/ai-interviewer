'use client';

import { updateBotAction } from '@/app/actions';
import { Bot, TopicBlock, KnowledgeSource } from '@prisma/client';
import { useState } from 'react';
import { showToast } from '@/components/toast';
import { colors } from '@/lib/design-system';
import RefineInput from '@/components/RefineInput';

type BotWithRelations = Bot & {
    topics: TopicBlock[];
    knowledgeSources: KnowledgeSource[];
    useWarmup?: boolean;
};

import { Icons } from '@/components/ui/business-tuner/Icons';
import { Info, Check, Lock } from 'lucide-react';
import { UpgradeModal } from '@/components/modals/UpgradeModal';
import Link from 'next/link';

export default function BotConfigForm({ bot, canUseBranding = false, canUseAdvancedInterview = false, currentPlan = 'TRIAL' }: { bot: BotWithRelations, canUseBranding?: boolean, canUseAdvancedInterview?: boolean, currentPlan?: string }) {
    const updateAction = updateBotAction.bind(null, bot.id);
    const [quality, setQuality] = useState(() => {
        const saved = bot.interviewerQuality;
        if (saved === 'avanzato' && canUseAdvancedInterview) return 'avanzato';
        return 'standard';
    });
    const [isRecruiting, setIsRecruiting] = useState(bot.collectCandidateData ?? false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Wrapper to ignore return type compatibility issues with form action
    const handleSubmit = async (formData: FormData) => {
        await updateAction(formData);
        showToast('✅ Bot settings saved successfully!', 'success');
    };

    return (
        <form action={handleSubmit} className="space-y-8 bg-white p-6 rounded shadow">

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Core Identity</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Bot Name</label>
                        <input name="name" defaultValue={bot.name} className="w-full border p-2 rounded" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Language</label>
                        <select name="language" defaultValue={bot.language} className="w-full border p-2 rounded">
                            <option value="en">English</option>
                            <option value="it">Italiano</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">Public URL (Slug)</label>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 whitespace-nowrap">businesstuner.voler.ai/i/</span>
                        <input
                            name="slug"
                            defaultValue={bot.slug}
                            pattern="[a-z0-9-]+"
                            title="Solo lettere minuscole, numeri e trattini"
                            className="flex-1 border p-2 rounded font-mono text-sm"
                            required
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">L&apos;URL pubblico dell&apos;intervista. Usa solo lettere minuscole, numeri e trattini.</p>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">Tone & Persona</label>
                    <input name="tone" defaultValue={bot.tone || ''} placeholder="e.g. Professional, Empathetic, Casual" className="w-full border p-2 rounded" />
                </div>
                <div className="mt-4">
                    <RefineInput
                        name="introMessage"
                        label="Welcome Message (First interaction)"
                        defaultValue={bot.introMessage || ''}
                        fieldType="intro"
                        rows={3}
                        placeholder="Hi! I'm here to interview you about..."
                    />
                    <p className="text-xs text-gray-500 mt-1">If set, the bot will start the conversation with this exact message.</p>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Research Context</h2>
                <div className="space-y-4">
                    <RefineInput
                        name="researchGoal"
                        label="Research Goal"
                        defaultValue={bot.researchGoal || ''}
                        fieldType="goal"
                        rows={4}
                        placeholder="What do you want to learn from users?"
                    />
                    <RefineInput
                        name="targetAudience"
                        label="Target Audience"
                        defaultValue={bot.targetAudience || ''}
                        fieldType="target"
                        rows={2}
                        placeholder="Who are you interviewing?"
                    />
                </div>
            </section>


            {/* SCOPE MARKER */}
            <input type="hidden" name="_scope" value="all" />

            {/* BRANDING MOVED TO NEW COMPONENT */}

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Constraints & Features</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium mb-3">Interview Quality</label>
                        <input type="hidden" name="interviewerQuality" value={quality} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Standard Card */}
                            <button
                                type="button"
                                onClick={() => setQuality('standard')}
                                className={`text-left p-4 rounded-lg border-2 transition-all ${
                                    quality === 'standard'
                                        ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                        quality === 'standard' ? 'border-amber-500' : 'border-gray-300'
                                    }`}>
                                        {quality === 'standard' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                    </div>
                                    <span className="font-semibold text-gray-900">Standard</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-3 ml-6">Interviste rapide e scalabili</p>
                                <ul className="space-y-1.5 ml-6">
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Veloce (&lt; 3s per risposta)
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Strutturato e comparabile
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Ideale per survey e validazione
                                    </li>
                                </ul>
                            </button>

                            {/* Avanzato Card */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canUseAdvancedInterview) {
                                        setShowUpgradeModal(true);
                                        return;
                                    }
                                    setQuality('avanzato');
                                }}
                                className={`text-left p-4 rounded-lg border-2 transition-all relative ${
                                    quality === 'avanzato'
                                        ? 'border-amber-500 bg-amber-50/30 ring-2 ring-amber-500'
                                        : !canUseAdvancedInterview
                                        ? 'border-gray-200 opacity-60 cursor-not-allowed'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                        quality === 'avanzato' ? 'border-amber-500' : 'border-gray-300'
                                    }`}>
                                        {quality === 'avanzato' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                    </div>
                                    <span className="font-semibold text-gray-900">Avanzato</span>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-full">PRO</span>
                                    {!canUseAdvancedInterview && <Lock size={14} className="text-gray-400" />}
                                </div>
                                <p className="text-sm text-gray-600 mb-3 ml-6">Come avere un ricercatore qualitativo esperto</p>
                                <ul className="space-y-1.5 ml-6">
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Modello AI critico su ogni risposta
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Turni riflessivi e sintesi cross-topic
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Rilevamento esitazioni
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check size={14} className="text-green-500 shrink-0" />
                                        Transizioni narrative naturali
                                    </li>
                                </ul>
                                <p className="text-[10px] text-amber-600 mt-3 ml-6 flex items-center gap-1">
                                    <Info size={10} />
                                    Consuma più crediti rispetto alla modalità standard
                                </p>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Max Duration (Minutes)</label>
                        <input type="number" name="maxDurationMins" defaultValue={bot.maxDurationMins} className="w-full border p-2 rounded" />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                        <input
                            type="checkbox"
                            name="useWarmup"
                            id="useWarmup"
                            defaultChecked={bot.useWarmup ?? true}
                            className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                            <label htmlFor="useWarmup" className="block text-sm font-medium text-gray-700">Abilita "Let's warm up"</label>
                            <p className="text-xs text-gray-500">Se disabilitato, l'intervista passerà direttamente alle domande principali dopo l'introduzione.</p>
                        </div>
                    </div>

                    <div className="pt-6 col-span-1 md:col-span-2 border-t mt-4">
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                name="collectCandidateData"
                                id="collectCandidateData"
                                checked={isRecruiting}
                                onChange={(e) => setIsRecruiting(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <label htmlFor="collectCandidateData" className="block text-sm font-medium text-gray-700">Abilita "Data Collection Mode"</label>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-full">Pro</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Ideale per Recruiting o Lead Generation. L&apos;AI chiederà i dati di contatto alla fine.
                                </p>
                            </div>
                        </div>

                        {isRecruiting && (
                            <div className="ml-8 bg-blue-50/50 p-4 rounded-lg border border-blue-100 animate-fadeIn">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-3">Dati da raccogliere (Lead / Candidato)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'name', label: 'Nome Completo' },
                                        { id: 'email', label: 'Email Address' },
                                        { id: 'phone', label: 'Telefono' },
                                        { id: 'company', label: 'Azienda / Organizzazione' },
                                        { id: 'linkedin', label: 'LinkedIn / Social' },
                                        { id: 'portfolio', label: 'Portfolio / Website' },
                                        { id: 'role', label: 'Ruolo Corrente / Job Title' },
                                        { id: 'location', label: 'Città / Locations' },
                                        { id: 'budget', label: 'Budget (Lead Gen)' },
                                        { id: 'availability', label: 'Disponibilità (Recruiting)' },
                                    ].map((field) => (
                                        <label key={field.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                name="candidateFields"
                                                value={field.id}
                                                defaultChecked={
                                                    // Handle JsonValue (string[] or null)
                                                    Array.isArray(bot.candidateDataFields)
                                                        ? (bot.candidateDataFields as string[]).includes(field.id)
                                                        : ['name', 'email'].includes(field.id) // Default fields
                                                }
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            {field.label}
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[10px] text-blue-600 mt-3 flex items-center gap-1">
                                    <Info size={12} />
                                    L&apos;AI chiederà questi dati in modo colloquiale quando l&apos;utente mostra interesse o alla fine.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>


            <div className="pt-4 align-right">
                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                    Save Changes
                </button>
            </div>
            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlan={currentPlan}
                requiredPlan="PRO"
                feature="Intervista Avanzata"
                reason="feature_locked"
            />
        </form >
    );
}
