import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import StartInterviewButton from './start-button';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const bot = await prisma.bot.findUnique({
        where: { slug },
    });

    if (!bot) notFound();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">{bot.name}</h1>
                    <p className="text-gray-500">{bot.description}</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-900 space-y-2">
                    <div className="flex justify-between font-medium">
                        <span>Duration</span>
                        <span>~{bot.maxDurationMins} mins</span>
                    </div>
                </div>

                <div className="text-sm text-gray-500">
                    <p>
                        Your responses will be used for research purposes according to the configuration of this bot.
                        Privacy Level: <strong className="capitalize">{bot.anonymizationLevel}</strong>
                    </p>
                </div>

                <StartInterviewButton botId={bot.id} />

                <div className="text-center">
                    <button className="text-xs text-gray-400 hover:text-gray-600">
                        Learn more about privacy
                    </button>
                </div>
            </div>
        </div>
    );
}
