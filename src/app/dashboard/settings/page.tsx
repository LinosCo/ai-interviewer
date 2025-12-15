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

    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: "default" }
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
                    {/* Platform Settings Form - includes API keys and methodology */}
                    <PlatformSettingsForm
                        userId={user.id}
                        isAdmin={user.role === 'ADMIN'}
                        currentKnowledge={currentKnowledge}
                        settingsId={user.platformSettings?.id}
                        // For Admins, populate with Global Config. 
                        // For Users, populate with personal override IF it exists, otherwise empty (masked later)
                        platformOpenaiApiKey={
                            user.role === 'ADMIN'
                                ? (globalConfig?.openaiApiKey || '')
                                : (user.platformOpenaiApiKey || '')
                        }
                        platformAnthropicApiKey={
                            user.role === 'ADMIN'
                                ? (globalConfig?.anthropicApiKey || '')
                                : (user.platformAnthropicApiKey || '')
                        }
                    />
                </div>
            </div>
        </div>
    );
}
