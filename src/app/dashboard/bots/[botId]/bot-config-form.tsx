'use client';

import { updateBotAction } from '@/app/actions';
import { Bot, TopicBlock, KnowledgeSource } from '@prisma/client';

type BotWithRelations = Bot & {
    topics: TopicBlock[];
    knowledgeSources: KnowledgeSource[];
};

export default function BotConfigForm({ bot }: { bot: BotWithRelations }) {
    const updateAction = updateBotAction.bind(null, bot.id);

    // Wrapper to ignore return type compatibility issues with form action
    const handleSubmit = async (formData: FormData) => {
        await updateAction(formData);
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
                            <select name="modelProvider" defaultValue={bot.modelProvider} className="w-full border p-2 rounded">
                                <option value="openai">OpenAI (GPT-4)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Model Name</label>
                            <input name="modelName" defaultValue={bot.modelName} className="w-full border p-2 rounded" placeholder="gpt-4o / claude-3-5-sonnet-20241022" />
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
