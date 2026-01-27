import { signOut, auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { gradients } from '@/lib/design-system';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { StrategyCopilot } from '@/components/copilot/StrategyCopilot';
import { PLANS, PlanType } from '@/config/plans';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    let isAdmin = false;
    let userTier = 'TRIAL';
    let organizationId = '';
    let hasCMSIntegration = false;
    let canManageProjects = false;
    let hasChatbot = false;
    let hasVisibilityTracker = false;
    let hasAiTips = false;

    if (session?.user?.id) {
        // Get user with plan info
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                plan: true,
                memberships: {
                    take: 1,
                    include: {
                        organization: {
                            include: {
                                projects: {
                                    include: {
                                        cmsConnection: {
                                            select: { id: true, status: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        isAdmin = user?.role === 'ADMIN' || user?.plan === 'ADMIN';

        if (user) {
            // Use user's plan directly
            userTier = user.plan || 'TRIAL';
            const membership = user.memberships[0];

            if (membership) {
                organizationId = membership.organizationId;

                // Check if the plan includes CMS feature
                const planType = userTier as PlanType;
                const plan = PLANS[planType] || PLANS[PlanType.TRIAL];
                const hasCMSFeature = plan.features.cmsIntegrations;

                // Check if any project has an active CMS connection AND the plan supports it
                hasCMSIntegration = hasCMSFeature && membership.organization.projects.some(
                    (p: any) => p.cmsConnection?.status === 'ACTIVE'
                );

                // Admin bypasses all feature checks
                if (isAdmin) {
                    canManageProjects = true;
                    hasChatbot = true;
                    hasVisibilityTracker = true;
                    hasAiTips = true;
                } else {
                    // Check if user can manage multiple projects (STARTER and above)
                    canManageProjects = plan.features.maxProjects === -1 || plan.features.maxProjects > 1;

                    // Feature flags based on plan
                    hasChatbot = plan.features.chatbot;
                    hasVisibilityTracker = plan.features.visibilityTracker;
                    hasAiTips = plan.features.aiTips;
                }
            }
        }
    }

    const signOutAction = async () => {
        'use server';
        await signOut({ redirectTo: "/" });
    };

    return (
        <ProjectProvider>
            <div className="flex flex-col md:flex-row h-screen overflow-hidden font-sans" style={{ background: gradients.mesh }}>

                <DashboardSidebar
                    isAdmin={isAdmin}
                    signOutAction={signOutAction}
                    hasCMSIntegration={hasCMSIntegration}
                    canManageProjects={canManageProjects}
                    hasChatbot={hasChatbot}
                    hasVisibilityTracker={hasVisibilityTracker}
                    hasAiTips={hasAiTips}
                />

                {/* Main Content Area */}
                <div className="flex-grow overflow-y-auto p-4 md:p-8 relative z-10">
                    <div style={{ maxWidth: '1200px', margin: '0 auto', minHeight: '100%' }}>
                        {children}
                    </div>
                </div>

                {/* Strategy Copilot - AI Assistant */}
                <StrategyCopilot
                    userTier={userTier}
                    organizationId={organizationId}
                />
            </div>
        </ProjectProvider>
    );
}

