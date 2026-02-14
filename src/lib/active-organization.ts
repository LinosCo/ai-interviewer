import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

type ResolveOptions = {
    preferredOrganizationId?: string | null;
};

export async function resolveActiveOrganizationIdForUser(
    userId: string,
    options?: ResolveOptions
): Promise<string | null> {
    const preferredOrganizationId = options?.preferredOrganizationId ?? null;
    const cookieStore = await cookies();
    const cookieOrganizationId = cookieStore.get('bt_selected_org_id')?.value || null;

    const targetOrganizationId = preferredOrganizationId || cookieOrganizationId;

    if (targetOrganizationId) {
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId: targetOrganizationId
                }
            },
            select: { organizationId: true }
        });

        if (membership?.organizationId) {
            return membership.organizationId;
        }
    }

    const fallbackMembership = await prisma.membership.findFirst({
        where: { userId },
        orderBy: { joinedAt: 'asc' },
        select: { organizationId: true }
    });

    return fallbackMembership?.organizationId || null;
}
