import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { canCreateChatbot, canPublishBot, getUsageStats } from '@/lib/usage';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    organization: {
                        include: {
                            subscription: {
                                select: {
                                    id: true,
                                    status: true,
                                    currentPeriodEnd: true,
                                    tier: true
                                }
                            }
                        }
                    },
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
                    cmsConnection: true // Fetch CMS connection
                }
            }
        }
    });

    if (!user) return <div>Utente non trovato.</div>;

    // Get organization from memberships first (more reliable)
    const userWithMembership = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            memberships: {
                take: 1,
                include: {
                    organization: {
                        include: {
                            subscription: {
                                select: {
                                    id: true,
                                    status: true,
                                    currentPeriodEnd: true,
                                    tier: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Fallback chain for organizationId
    const project = user.ownedProjects[0];
    const organizationId = userWithMembership?.memberships[0]?.organizationId || project?.organization?.id;
    const projectId = project?.id;

    const isAdmin = user.role === 'ADMIN';

    // Check limits
    const canCreateInterview = organizationId && !isAdmin ? await canPublishBot(organizationId) : { allowed: true };
    const canCreateChatbotCheck = organizationId && !isAdmin ? await canCreateChatbot(organizationId) : { allowed: true };

    // Get bots and split by type
    const allBots = user.ownedProjects.flatMap(p => p.bots);
    const recentResponses = allBots
        .flatMap(bot => bot.conversations.map(c => ({
            ...c,
            botName: bot.name,
            botId: bot.id,
            projectId: bot.projectId, // Ensure projectId is available for filtering
            type: (bot as any).botType || 'interview'
        })))
        .filter(c => c.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);

    // Fetch usage and subscription data
    const usage = organizationId ? await getUsageStats(organizationId) : null;
    const subscription = userWithMembership?.memberships[0]?.organization?.subscription || project?.organization?.subscription;
    const status = subscription?.status || 'ACTIVE';
    const trialDaysLeft = subscription?.currentPeriodEnd ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    // Prepare projects with CMS data for client
    const projectsWithCms = user.ownedProjects.map(p => ({
        id: p.id,
        name: p.name,
        cmsConnection: p.cmsConnection
    }));

    // Serialize BigInts in usage stats to avoid errors
    const serializedUsage = usage ? JSON.parse(JSON.stringify(usage, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value // return everything else unchanged
    )) : null;

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
