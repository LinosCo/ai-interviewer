'use client';

import { updateBotAction } from '@/app/actions';
import { Bot, TopicBlock, KnowledgeSource } from '@prisma/client';
import { useState } from 'react';
import { showToast } from '@/components/toast';

type BotWithRelations = Bot & {
    topics: TopicBlock[];
    knowledgeSources: KnowledgeSource[];
};

export default function BotConfigForm({ bot }: { bot: BotWithRelations }) {
    const updateAction = updateBotAction.bind(null, bot.id);
    const [provider, setProvider] = useState(bot.modelProvider || 'openai');

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
                    <label className="block text-sm font-medium mb-1">Tone & Persona</label>
                    <input name="tone" defaultValue={bot.tone || ''} placeholder="e.g. Professional, Empathetic, Casual" className="w-full border p-2 rounded" />
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Research Context</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Research Goal</label>
                        <textarea name="researchGoal" defaultValue={bot.researchGoal || ''} className="w-full border p-2 rounded h-24" placeholder="What do you want to learn from users?" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Target Audience</label>
                        <textarea name="targetAudience" defaultValue={bot.targetAudience || ''} className="w-full border p-2 rounded h-16" placeholder="Who are you interviewing?" />
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">🎨 Branding & Customization</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Chat Logo</label>
                        <input
                            type="file"
                            accept="image/*"
                            name="logo"
                            className="w-full border p-2 rounded"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const logoInput = document.getElementById('logoUrl') as HTMLInputElement;
                                        if (logoInput) logoInput.value = reader.result as string;
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                        <input type="hidden" id="logoUrl" name="logoUrl" defaultValue={bot.logoUrl || ''} />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 200x200px PNG with transparent background</p>
                        {bot.logoUrl && (
                            <div className="mt-2">
                                <img src={bot.logoUrl} alt="Current logo" className="h-16 w-16 object-contain border rounded p-1" />
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Primary Color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    name="primaryColor"
                                    defaultValue={bot.primaryColor || '#6366f1'}
                                    className="h-10 w-20 border rounded cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">{bot.primaryColor || '#6366f1'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Background</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    name="backgroundColor"
                                    defaultValue={bot.backgroundColor || '#ffffff'}
                                    className="h-10 w-20 border rounded cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">{bot.backgroundColor || '#ffffff'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Text Color</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    name="textColor"
                                    defaultValue={bot.textColor || '#1f2937'}
                                    className="h-10 w-20 border rounded cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">{bot.textColor || '#1f2937'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border">
                        <p className="text-sm font-medium mb-2">Preview</p>
                        <div className="bg-white p-4 rounded shadow-sm" style={{ backgroundColor: bot.backgroundColor || '#ffffff' }}>
                            <div className="flex items-center gap-2 mb-3">
                                {bot.logoUrl && <img src={bot.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />}
                                <span style={{ color: bot.textColor || '#1f2937' }}>Sample Question?</span>
                            </div>
                            <button
                                type="button"
                                className="px-4 py-2 rounded text-white text-sm"
                                style={{ backgroundColor: bot.primaryColor || '#6366f1' }}
                            >
                                Answer Button
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Constraints</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Max Duration (Minutes)</label>
                        <input type="number" name="maxDurationMins" defaultValue={bot.maxDurationMins} className="w-full border p-2 rounded" />
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Model & API Configuration</h2>
                <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800">
                        Leave keys empty to use the platform defaults (if configured).
                        Keys provided here override environment variables for this bot.
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
                                        <option value="gpt-5.2">GPT-5.2 (Future/Preview)</option>
                                        <option value="gpt-4o">GPT-4o (Recommended)</option>
                                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="claude-4.5-sonnet">Claude 4.5 Sonnet (Future)</option>
                                        <option value="claude-4.5-opus">Claude 4.5 Opus</option>
                                        <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                                        <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
                                        <option value="claude-3-opus-latest">Claude 3 Opus</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">OpenAI API Key (Optional)</label>
                        <input
                            type="password"
                            name="openaiApiKey"
                            defaultValue={bot.openaiApiKey || ''}
                            placeholder="sk-..."
                            className="w-full border p-2 rounded font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Anthropic API Key (Optional)</label>
                        <input
                            type="password"
                            name="anthropicApiKey"
                            defaultValue={bot.anthropicApiKey || ''}
                            placeholder="sk-ant-..."
                            className="w-full border p-2 rounded font-mono"
                        />
                    </div>
                </div>
            </section>

            <div className="pt-4 align-right">
                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                    Save Changes
                </button>
            </div>
        </form>
    );
}
