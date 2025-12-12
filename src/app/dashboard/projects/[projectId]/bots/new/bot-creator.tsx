'use client';

import { createBotAction, generateBotConfigAction } from '@/app/actions';
import { useState } from 'react';

export default function BotCreator({ projectId }: { projectId: string }) {
    const createAction = createBotAction.bind(null, projectId);

    const [mode, setMode] = useState<'manual' | 'ai'>('manual');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // AI Generated Data State
    const [generatedData, setGeneratedData] = useState<any>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        try {
            const result = await generateBotConfigAction(prompt);
            setGeneratedData(result);
        } catch (e: any) {
            alert("Error generating bot: " + e.message);
        } finally {
            setIsGenerating(false);
        }
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

            {mode === 'ai' && !generatedData && (
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
                        className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isGenerating ? 'Designing Interview...' : 'Generate with AI'}
                    </button>
                </div>
            )}

            {(mode === 'manual' || generatedData) && (
                <form action={createAction} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Bot Name</label>
                        <input
                            name="name"
                            defaultValue={generatedData?.name || ''}
                            required
                            className="w-full border p-2 rounded"
                            placeholder="e.g. Morning Rituals Interviewer"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description / Goal</label>
                        <textarea
                            name="description"
                            defaultValue={generatedData?.researchGoal || ''}
                            className="w-full border p-2 rounded h-24"
                            placeholder="Internal notes about this bot..."
                        />
                    </div>

                    {generatedData && (
                        <div className="bg-green-50 p-4 rounded border border-green-200 text-sm">
                            <p className="font-semibold text-green-800 mb-2">AI Suggestions Applied:</p>
                            <ul className="list-disc pl-5 space-y-1 text-green-700">
                                <li>Target Audience: {generatedData.targetAudience}</li>
                                <li>Topics Generated: {generatedData.topics.length}</li>
                            </ul>
                            <p className="mt-2 text-xs">Note: Topics will be created after you click Create.</p>
                            {/* We need to pass hidden fields to createBotAction to save these topics immediately 
                                OR update createBotAction to accept complex data. 
                                Current createBotAction creates default topics. 
                                I should pass this JSON stringified?
                            */}
                            <input type="hidden" name="aiGeneratedTopics" value={JSON.stringify(generatedData.topics)} />
                            <input type="hidden" name="targetAudience" value={generatedData.targetAudience} />
                            <input type="hidden" name="researchGoal" value={generatedData.researchGoal} />
                        </div>
                    )}

                    <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                        {generatedData ? 'Create AI-Designed Bot' : 'Create Bot'}
                    </button>
                </form>
            )}
        </div>
    );
}
