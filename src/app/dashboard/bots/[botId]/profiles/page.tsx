
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import ProfilesList from '@/components/dashboard/ProfilesList';
import Link from 'next/link';

export default async function BotProfilesPage({ params }: { params: Promise<{ botId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId } = await params;

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            project: { include: { organization: true } }
        }
    });

    if (!bot) notFound();

    // Verify access
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: true,
            projectAccess: true
        }
    });

    const isOwner = user?.ownedProjects.some(p => p.id === bot.projectId);
    const hasAccess = user?.projectAccess.some(pa => pa.projectId === bot.projectId);

    if (!isOwner && !hasAccess) redirect('/dashboard');

    // Fetch conversations with profiles
    // We filter raw SQL or just fetch and filter in JS if not heavy (candidateProfile is JSON)
    // Actually prisma can filter on JSON path if supported, but simpler to check not null
    const conversations = await (prisma as any).conversation.findMany({
        where: {
            botId: botId,
            candidateProfile: { not: { equals: null } }
        },
        orderBy: { startedAt: 'desc' },
        select: {
            id: true,
            startedAt: true,
            candidateProfile: true, // JSON
            status: true
        }
    }) as any[];

    const profiles = conversations.map(c => ({
        id: c.id,
        date: c.startedAt,
        status: c.status,
        data: c.candidateProfile as any
    }));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/bots/${bot.id}`} className="text-gray-500 hover:text-gray-900">
                        &larr; Indietro
                    </Link>
                    <h1 className="text-2xl font-bold">Profili Raccolti: {bot.name}</h1>
                </div>
                {/* CSV Export Button Component */}
            </div>

            <ProfilesList profiles={profiles} />
        </div>
    );
}
