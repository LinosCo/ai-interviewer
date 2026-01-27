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
            const orgName = `${user.name || 'Mio'} Workspace`;
            const slug = `${user.id.toLowerCase()}-personal`;

            const newOrg = await prisma.organization.create({
                data: {
                    name: orgName,
                    slug,
                    plan: (user as any).plan || 'FREE', // Migrazione piano
                    monthlyCreditsLimit: (user as any).monthlyCreditsLimit,
                    monthlyCreditsUsed: (user as any).monthlyCreditsUsed,
                    creditsResetDate: (user as any).creditsResetDate,
                    packCreditsAvailable: (user as any).packCreditsAvailable,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER',
                            status: 'ACTIVE'
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    plan: true
                }
            });

            // Migrazione progetti esistenti (se ce ne sono rimasti senza org)
            await prisma.project.updateMany({
                where: { ownerId: user.id, organizationId: "" }, // Hypothetical orphaned projects
                data: { organizationId: newOrg.id }
            });

            organizations = [{ ...newOrg, role: 'OWNER' }];
        }

        return NextResponse.json({ organizations });

    } catch (error) {
        console.error('Fetch Organizations Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
