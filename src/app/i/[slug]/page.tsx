import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import LandingPage from '@/components/interview/LandingPage';
import { canStartInterview } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const bot = await prisma.bot.findUnique({
        where: { slug },
        include: {
            project: { include: { organization: true } },
            topics: { orderBy: { orderIndex: 'asc' } }
        }
    });

    if (!bot) notFound();

    // Usage check
    const organizationId = bot.project?.organizationId;
    if (organizationId) {
        const check = await canStartInterview(organizationId);
        if (!check.allowed) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-amber-50 flex-col p-6 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-amber-900 mb-2">Limite raggiunto</h1>
                    <p className="text-amber-700 max-w-md mx-auto">{check.reason}</p>
                    <p className="mt-4 text-sm text-amber-600">Torna più tardi o contatta il proprietario dell'intervista.</p>
                </div>
            );
        }
    }

    // Server Action to start interview
    const startInterview = async () => {
        'use server';

        // Initialize with the first topic
        const firstTopic = bot.topics[0];

        const conversation = await prisma.conversation.create({
            data: {
                botId: bot.id,
                participantId: `anon-${Date.now()}`,
                status: 'STARTED',
                currentTopicId: firstTopic?.id || null, // Start with first topic
            }
        });

        redirect(`/i/chat/${conversation.id}`);
    };

    return <LandingPage bot={bot} onStart={startInterview} />;
}
