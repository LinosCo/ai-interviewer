import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    console.log('[API] GET /api/organizations called');
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                ownedProjects: {
                    select: {
                        organizationId: true
                    }
                },
                memberships: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                plan: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return new Response('User not found', { status: 404 });
        }

        // Backfill membership rows for legacy cases where ownerId was updated
        // but membership was not created for the target organization.
        try {
            const membershipOrgIds = new Set(user.memberships.map((m) => m.organizationId));
            const missingOwnedOrgIds = Array.from(
                new Set(
                    user.ownedProjects
                        .map((p) => p.organizationId)
                        .filter((orgId): orgId is string => Boolean(orgId))
                        .filter((orgId) => !membershipOrgIds.has(orgId))
                )
            );

            if (missingOwnedOrgIds.length > 0) {
                const now = new Date();
                await prisma.membership.createMany({
                    data: missingOwnedOrgIds.map((organizationId) => ({
                        userId: user.id,
                        organizationId,
                        role: 'MEMBER',
                        status: 'ACTIVE',
                        acceptedAt: now,
                        joinedAt: now
                    })),
                    skipDuplicates: true
                });
            }
        } catch (backfillError) {
            console.error('Backfill memberships failed (non-critical):', backfillError);
            // Continue execution, do not fail the request
        }

        const memberships = await prisma.membership.findMany({
            where: { userId: user.id },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        plan: true
                    }
                }
            }
        });

        let organizations = memberships.map(m => ({
            ...m.organization,
            role: m.role
        }));

        // Se l'utente non ha organizzazioni, creane una di default (Personale)
        if (organizations.length === 0) {
            try {
                const { getOrCreateDefaultOrganization } = await import('@/lib/organizations');
                const newOrg = await getOrCreateDefaultOrganization(user.id);

                // Migrazione progetti esistenti (se ce ne sono rimasti senza org)
                await prisma.project.updateMany({
                    where: { ownerId: user.id, organizationId: null },
                    data: { organizationId: newOrg.id }
                });

                organizations = [{
                    id: newOrg.id,
                    name: newOrg.name,
                    slug: newOrg.slug,
                    plan: newOrg.plan,
                    role: 'OWNER'
                }];
            } catch (createError) {
                console.error('Failed to create default organization:', createError);
                // Return empty list instead of crashing, client will show empty state
                // or we could return 500, but empty list allows the UI to render at least
            }
        }

        return NextResponse.json({ organizations });

    } catch (error: any) {
        console.error('Fetch Organizations Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
