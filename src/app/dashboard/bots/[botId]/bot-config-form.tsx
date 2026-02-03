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
import { Info } from 'lucide-react';
import Link from 'next/link';

export default function BotConfigForm({ bot, canUseBranding = false }: { bot: BotWithRelations, canUseBranding?: boolean }) {
    const updateAction = updateBotAction.bind(null, bot.id);
    const [provider, setProvider] = useState(bot.modelProvider || 'openai');
    const [isRecruiting, setIsRecruiting] = useState(bot.collectCandidateData ?? false);

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
                    <p className="text-xs text-gray-500 mt-1">L'URL pubblico dell'intervista. Usa solo lettere minuscole, numeri e trattini.</p>
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
                                    Ideale per Recruiting o Lead Generation. L'AI chiederà i dati di contatto alla fine.
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
                                    L'AI chiederà questi dati in modo colloquiale quando l'utente mostra interesse o alla fine.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-4 border">
                <details className="group">
                    <summary className="flex justify-between items-center font-medium cursor-pointer list-none text-gray-700">
                        <span className="flex items-center gap-2">
                            Advanced Settings (Model & API)
                        </span>
                        <span className="transition group-open:rotate-180">
                            <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                        </span>
                    </summary>
                    <div className="text-neutral-600 mt-4 group-open:animate-fadeIn">
                        <div className="space-y-4">
                            <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 border border-yellow-100">
                                These settings are for advanced users. By default, the platform handles model selection and API keys.
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Model Provider</label>
                                    <select
                                        name="modelProvider"
                                        value={provider}
                                        onChange={(e) => setProvider(e.target.value)}
                                        className="w-full border p-2 rounded"
                                    >
                                        <option value="openai">OpenAI (ChatGPT)</option>
                                        <option value="anthropic">Anthropic (Claude)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Model Name</label>
                                    <select name="modelName" defaultValue={bot.modelName} className="w-full border p-2 rounded">
                                        {provider === 'openai' ? (
                                            <>
                                                <optgroup label="GPT-4o (Flagship)">
                                                    <option value="gpt-4o">GPT-4o (Best Overall)</option>
                                                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                                                </optgroup>
                                                <optgroup label="Reasoning Models">
                                                    <option value="o1-preview">o1 Preview (Deep Reasoning)</option>
                                                    <option value="o1-mini">o1 Mini (Fast Reasoning)</option>
                                                </optgroup>
                                                <optgroup label="Legacy">
                                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                                </optgroup>

                                            </>
                                        ) : (
                                            <>
                                                <optgroup label="Claude 4.5 (New)">
                                                    <option value="claude-sonnet-4-5-20250929">Claude 4.5 Sonnet (2025-09-29)</option>
                                                </optgroup>
                                                <optgroup label="Claude 3.5 (Stable)">
                                                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                                                </optgroup>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">OpenAI API Key (Override)</label>
                                <input
                                    type="password"
                                    name="openaiApiKey"
                                    defaultValue={bot.openaiApiKey || ''}
                                    placeholder="sk-..."
                                    autoComplete="new-password"
                                    className="w-full border p-2 rounded font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Anthropic API Key (Override)</label>
                                <input
                                    type="password"
                                    name="anthropicApiKey"
                                    defaultValue={bot.anthropicApiKey || ''}
                                    placeholder="sk-ant-..."
                                    autoComplete="new-password"
                                    className="w-full border p-2 rounded font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </details>
            </section>

            <div className="pt-4 align-right">
                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                    Save Changes
                </button>
            </div>
        </form >
    );
}
