import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import PlatformSettingsForm from './settings-form';
import fs from 'fs';
import path from 'path';

export default async function PlatformSettingsPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { platformSettings: true }
    });

    if (!user) {
        redirect('/login');
    }

    // Load default methodology knowledge from file
    let defaultKnowledge = '';
    try {
        const knowledgePath = path.join(process.cwd(), 'knowledge', 'interview-methodology.md');
        defaultKnowledge = fs.readFileSync(knowledgePath, 'utf-8');
    } catch (error) {
        console.error('Could not load default knowledge:', error);
    }

    const currentKnowledge = user.platformSettings?.methodologyKnowledge || defaultKnowledge;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
                    <p className="text-gray-600 mt-2">
                        Configure platform-wide settings that apply to all your chatbots.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* API Keys Section */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">API Keys</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            These keys are used as defaults when individual bots don't have their own keys configured.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    OpenAI API Key
                                </label>
                                <input
                                    type="password"
                                    defaultValue={user.platformOpenaiApiKey || ''}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                    placeholder="sk-..."
                                    disabled
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Configure in environment variables (OPENAI_API_KEY)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Anthropic API Key
                                </label>
                                <input
                                    type="password"
                                    defaultValue={user.platformAnthropicApiKey || ''}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                                    placeholder="sk-ant-..."
                                    disabled
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Configure in environment variables (ANTHROPIC_API_KEY)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Interview Methodology Section */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4">Interview Methodology</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            This knowledge base is automatically included in all chatbot prompts.
                            Customize it to match your organization's interview methodology.
                        </p>
                        <PlatformSettingsForm
                            userId={user.id}
                            currentKnowledge={currentKnowledge}
                            settingsId={user.platformSettings?.id}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
