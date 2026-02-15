'use client';

import { createBotAction, generateBotConfigAction, refineTextAction } from '@/app/actions';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { RefinableField } from '@/components/refinable-field';

export default function BotCreator({ projectId }: { projectId: string }) {
    const createAction = createBotAction.bind(null, projectId);

    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        researchGoal: '',
        targetAudience: ''
    });

    // AI Generated Data State
    const [aiTopics, setAiTopics] = useState<any[]>([]);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        try {
            const result = await generateBotConfigAction(prompt);
            setFormData({
                name: result.name,
                description: result.description || '', // AI might not generate description separate from goal
                researchGoal: result.researchGoal,
                targetAudience: result.targetAudience
            });
            setAiTopics(result.topics);
        } catch (e: any) {
            alert("Error generating bot: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
            <h1 className="text-xl font-bold mb-6">Create New Bot</h1>

            <div className="flex gap-4 mb-6 border-b pb-4">
                <button
                    onClick={() => setMode('manual')}
                    className={`pb-2 px-1 ${mode === 'manual' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-500'}`}
                >
                    Manual Setup
                </button>
                <button
                    onClick={() => setMode('ai')}
                    className={`pb-2 px-1 ${mode === 'ai' ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-500'}`}
                >
                    Develop with AI
                </button>
            </div>

            {mode === 'ai' && aiTopics.length === 0 && (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                        Describe what you want to learn, and our AI will look for best practices to structure the interview.
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">What is your research goal?</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full border p-2 rounded h-32"
                            placeholder="e.g. I want to interview coffee drinkers to understand their morning routine and what motivates them to buy expensive beans."
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isGenerating ? 'Designing Interview...' : 'Generate with AI'}
                    </button>
                </div>
            )}

            {(mode === 'manual' || aiTopics.length > 0) && (
                <form action={createAction} className="space-y-4">
                    <RefinableField
                        label="Bot Name"
                        name="name"
                        value={formData.name}
                        onChange={(v) => updateField('name', v)}
                        context={formData.name || "New Bot"}
                    />

                    <RefinableField
                        label="Research Goal"
                        name="researchGoal"
                        value={formData.researchGoal}
                        onChange={(v) => updateField('researchGoal', v)}
                        context={formData.name}
                        multiline
                    />

                    <RefinableField
                        label="Target Audience"
                        name="targetAudience"
                        value={formData.targetAudience}
                        onChange={(v) => updateField('targetAudience', v)}
                        context={formData.name}
                    />

                    <RefinableField
                        label="Internal Description"
                        name="description"
                        value={formData.description}
                        onChange={(v) => updateField('description', v)}
                        context={formData.name}
                        multiline
                    />

                    {aiTopics.length > 0 && (
                        <div className="bg-green-50 p-4 rounded border border-green-200 text-sm">
                            <p className="font-semibold text-green-800 mb-2">AI Generated Topics:</p>
                            <ul className="list-disc pl-5 space-y-1 text-green-700">
                                {aiTopics.map((t: any, i) => (
                                    <li key={i}>{t.label}</li>
                                ))}
                            </ul>
                            <input type="hidden" name="aiGeneratedTopics" value={JSON.stringify(aiTopics)} />
                        </div>
                    )}

                    <CreateBotSubmitButton hasAiTopics={aiTopics.length > 0} />
                </form>
            )}
        </div>
    );
}

function CreateBotSubmitButton({ hasAiTopics }: { hasAiTopics: boolean }) {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            aria-busy={pending}
        >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending
                ? 'Creating...'
                : (hasAiTopics ? 'Create AI-Designed Bot' : 'Create Bot')}
        </button>
    );
}
