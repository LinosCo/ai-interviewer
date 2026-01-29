import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
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

        let organizations = user.memberships.map(m => ({
            ...m.organization,
            role: m.role
        }));

        // Se l'utente non ha organizzazioni, creane una di default (Personale)
        if (organizations.length === 0) {
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
        }

        return NextResponse.json({ organizations });

    } catch (error) {
        console.error('Fetch Organizations Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
