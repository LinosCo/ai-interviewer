import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ProjectAnalytics from '@/components/analytics/ProjectAnalytics';
import { redirect } from 'next/navigation';
import { ProjectWorkspaceShell } from '@/components/projects/ProjectWorkspaceShell';

export default async function AnalyticsPage(props: { params: Promise<{ projectId: string }> }) {
    const params = await props.params;
    const session = await auth();

    if (!session?.user?.email) {
        redirect('/login');
    }

    const [project, bots, tipCount, enabledRoutingCount] = await Promise.all([
        prisma.project.findUnique({
            where: { id: params.projectId },
            select: { id: true, name: true },
        }),
        prisma.bot.findMany({
            where: { projectId: params.projectId },
            select: { id: true, name: true, botType: true } as any
        }),
        prisma.projectTip.count({ where: { projectId: params.projectId } }),
        prisma.tipRoutingRule.count({ where: { projectId: params.projectId, enabled: true } }),
    ]);

    if (!project) {
        redirect('/dashboard/projects');
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ProjectWorkspaceShell
                projectId={params.projectId}
                projectName={project.name}
                activeSection="measure"
                eyebrow="Misura"
                title="Misura impatto e priorita"
                description="Leggi i risultati del progetto in chiave decisionale: cosa sta cambiando, dove si sta creando attrito e quale mossa conviene fare adesso."
                metrics={[
                    { label: 'Fonti incluse', value: String(bots.length), tone: 'accent' },
                    { label: 'Tip osservati', value: String(tipCount), tone: tipCount > 0 ? 'success' : 'default' },
                    { label: 'Routing attivo', value: `${enabledRoutingCount} regole`, tone: enabledRoutingCount > 0 ? 'success' : 'warning' },
                    { label: 'Focus', value: 'Decisione', tone: 'warning' },
                ]}
            >
                <div className="mt-8">
                    <ProjectAnalytics projectId={params.projectId} availableBots={bots as any} />
                </div>
            </ProjectWorkspaceShell>
        </div>
    );
}
