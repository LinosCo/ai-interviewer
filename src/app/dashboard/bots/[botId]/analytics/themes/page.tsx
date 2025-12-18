import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ThemesPage({ params }: { params: { botId: string } }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const bot = await prisma.bot.findUnique({
        where: { id: params.botId },
        include: { themes: { include: { occurrences: true } } }
    });

    if (!bot) notFound();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Themes: {bot.name}</h1>
                <Link href={`/dashboard/bots/${bot.id}/analytics`} className="text-amber-600 hover:underline">
                    Back to Analytics
                </Link>
            </div>

            {bot.themes.length === 0 ? (
                <div className="bg-white p-12 rounded shadow text-center">
                    <h3 className="text-lg font-medium text-gray-900">No themes extracted yet</h3>
                    <p className="text-gray-500 mt-2">Themes will appear here once enough interviews are analyzed.</p>
                    <button className="mt-4 bg-gray-100 text-gray-600 px-4 py-2 rounded hover:bg-gray-200">
                        Trigger Analysis (Simulated)
                    </button>
                </div>
            ) : (
                <div className="grid gap-6">
                    {bot.themes.map(theme => (
                        <div key={theme.id} className="bg-white p-6 rounded shadow border-l-4 border-amber-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">{theme.name}</h3>
                                    <span className="text-xs uppercase font-bold text-amber-600">{theme.category || 'General'}</span>
                                    <p className="text-gray-600 mt-2">{theme.description}</p>
                                </div>
                                <div className="text-3xl font-light text-gray-300">
                                    {theme.occurrences.length}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
