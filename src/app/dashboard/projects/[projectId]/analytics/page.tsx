import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ProjectAnalytics from '@/components/analytics/ProjectAnalytics';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage(props: { params: Promise<{ projectId: string }> }) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user?.email) {
        redirect('/login');
    }

    // Fetch bots for filtering
    const bots = await prisma.bot.findMany({
        where: { projectId: params.projectId },
        select: { id: true, name: true, botType: true } as any
    });

    return <ProjectAnalytics projectId={params.projectId} availableBots={bots as any} />;
}
