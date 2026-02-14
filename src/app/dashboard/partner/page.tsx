import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { PartnerService } from '@/services/partnerService';
import { prisma } from '@/lib/prisma';
import PartnerDashboardClient from './partner-dashboard-client';

export default async function PartnerDashboardPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    // Check if user is a partner
    const partnerStatus = await PartnerService.getPartnerStatus(session.user.id);
    if (!partnerStatus?.isPartner) {
        redirect('/partner'); // Redirect to partner landing page
    }

    // Get clients data
    const clientsData = await PartnerService.getPartnerClientsDetailed(session.user.id);

    // Get projects the partner can actually manage (org OWNER/ADMIN), not legacy ownerId.
    const adminMemberships = await prisma.membership.findMany({
        where: {
            userId: session.user.id,
            status: 'ACTIVE',
            role: { in: ['OWNER', 'ADMIN'] }
        },
        select: { organizationId: true }
    });

    const managedOrganizationIds = adminMemberships.map((m) => m.organizationId);
    const projects = managedOrganizationIds.length
        ? await prisma.project.findMany({
            where: {
                organizationId: { in: managedOrganizationIds }
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
        : [];

    // Get pending invites
    const pendingInvitesCount = await prisma.projectTransferInvite.count({
        where: {
            partnerId: session.user.id,
            status: 'pending',
            expiresAt: { gt: new Date() }
        }
    });

    return (
        <PartnerDashboardClient
            partnerStatus={partnerStatus}
            clientsData={clientsData}
            projects={projects}
            pendingInvitesCount={pendingInvitesCount}
        />
    );
}
