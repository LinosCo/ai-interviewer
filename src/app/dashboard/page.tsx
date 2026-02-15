import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { canCreateChatbot, canPublishBot, getUsageStats } from '@/lib/usage';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getOrCreateDefaultOrganization } from '@/lib/organizations';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    // Hard guard for first-login races: ensure at least one organization exists.
    await getOrCreateDefaultOrganization(session.user.id);

    // Read active organization from cookies
    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get('bt_selected_org_id')?.value;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            memberships: {
                include: {
                    organization: {
                        include: {
                            subscription: true,
                            projects: {
                                include: {
                                    bots: {
                                        include: {
                                            conversations: {
                                                select: { id: true, status: true, completedAt: true },
                                                orderBy: { completedAt: 'desc' },
                                                take: 10
                                            }
                                        },
                                        orderBy: { updatedAt: 'desc' }
                                    },
                                    cmsConnection: true,
                                    newCmsConnection: true,
                                    cmsShares: {
                                        include: {
                                            connection: true
                                        },
                                        orderBy: { createdAt: 'asc' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user || user.memberships.length === 0) {
        return <div>Nessuna organizzazione trovata. Contatta l&apos;assistenza se pensi sia un errore.</div>;
    }

    // Find active membership
    const membership = activeOrgId
        ? user.memberships.find(m => m.organizationId === activeOrgId) || user.memberships[0]
        : user.memberships[0];

    const organization = membership.organization;
    const organizationId = organization.id;
    const isAdmin = user.role === 'ADMIN' || user.plan === 'ADMIN';
    const isOrgAdminMember = isAdmin || ['OWNER', 'ADMIN'].includes(membership.role);

    let accessibleProjectIds: Set<string> | null = null;
    if (!isOrgAdminMember) {
        const scopedProjectAccess = await prisma.projectAccess.findMany({
            where: {
                userId: session.user.id,
                project: {
                    organizationId
                }
            },
            select: { projectId: true }
        });
        accessibleProjectIds = new Set(scopedProjectAccess.map((entry) => entry.projectId));
    }
    const accessibleProjects = isOrgAdminMember
        ? organization.projects
        : organization.projects.filter((project) => accessibleProjectIds?.has(project.id));

    // Get limits and usage for this specific organization
    const usage = await getUsageStats(organizationId);
    const subscription = organization.subscription;
    const status = subscription?.status || 'ACTIVE';
    const nowMs = new Date().getTime();
    const trialDaysLeft = subscription?.currentPeriodEnd
        ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - nowMs) / (1000 * 60 * 60 * 24))
        : 0;

    // Permissions based on organization's subscription
    const canCreateInterview = isAdmin ? { allowed: true } : await canPublishBot(organizationId);
    const canCreateChatbotCheck = isAdmin ? { allowed: true } : await canCreateChatbot(organizationId);

    // Prepare content for client
    const allBots = accessibleProjects.flatMap(p => p.bots);
    const recentResponses = allBots
        .flatMap(bot => bot.conversations.map(c => ({
            ...c,
            botName: bot.name,
            botId: bot.id,
            projectId: bot.projectId,
            type: (bot as any).botType || 'interview'
        })))
        .filter(c => c.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);

    const projectsWithCms = accessibleProjects.map(p => {
        const sharedCms = p.cmsShares?.find(s => s.connection.status !== 'DISABLED')?.connection || null;
        return {
            id: p.id,
            name: p.name,
            cmsConnection: p.newCmsConnection || p.cmsConnection || sharedCms
        };
    });

    // Serialize BigInts in usage stats
    const serializedUsage = JSON.parse(JSON.stringify(usage, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));

    return (
        <DashboardClient
            user={user}
            usage={serializedUsage}
            subscription={subscription}
            status={status}
            trialDaysLeft={trialDaysLeft}
            isAdmin={isAdmin}
            canCreateInterview={canCreateInterview}
            canCreateChatbotCheck={canCreateChatbotCheck}
            allBots={allBots}
            initialRecentResponses={recentResponses}
            projectsWithCms={projectsWithCms}
        />
    );
}
