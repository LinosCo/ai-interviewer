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

    if (session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });
        isAdmin = user?.role === 'ADMIN';

        // Get organization and subscription for Strategy Copilot
        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            include: {
                organization: {
                    include: {
                        subscription: true,
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
        });

        if (membership) {
            userTier = membership.organization.subscription?.tier || 'TRIAL';
            organizationId = membership.organizationId;

            // Check if the plan includes CMS feature
            const planType = userTier as PlanType;
            const plan = PLANS[planType] || PLANS[PlanType.TRIAL];
            const hasCMSFeature = plan.features.cmsIntegrations;

            // Check if any project has an active CMS connection AND the plan supports it
            hasCMSIntegration = hasCMSFeature && membership.organization.projects.some(
                (p: any) => p.cmsConnection?.status === 'ACTIVE'
            );
        }
    }

    const signOutAction = async () => {
        'use server';
        await signOut({ redirectTo: "/" });
    };

    return (
        <ProjectProvider>
            <div className="flex flex-col md:flex-row h-screen overflow-hidden font-sans" style={{ background: gradients.mesh }}>

                <DashboardSidebar isAdmin={isAdmin} signOutAction={signOutAction} hasCMSIntegration={hasCMSIntegration} />

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

