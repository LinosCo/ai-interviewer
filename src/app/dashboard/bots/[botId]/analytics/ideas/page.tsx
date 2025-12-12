import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

export default async function IdeasPage({ params }: { params: { botId: string } }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const bot = await prisma.bot.findUnique({
        where: { id: params.botId },
        include: { hotIdeas: true }
    });

    if (!bot) notFound();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Hot Ideas: {bot.name}</h1>
                <Link href={`/dashboard/bots/${bot.id}/analytics`} className="text-blue-600 hover:underline">
                    Back to Analytics
                </Link>
            </div>

            <div className="grid gap-4">
                {bot.hotIdeas.length === 0 && (
                    <p className="text-gray-500">No ideas extracted yet.</p>
                )}
                {bot.hotIdeas.map(idea => (
                    <div key={idea.id} className="bg-white p-4 rounded shadow bg-yellow-50 border border-yellow-100">
                        <p className="font-medium text-gray-800">💡 {idea.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
