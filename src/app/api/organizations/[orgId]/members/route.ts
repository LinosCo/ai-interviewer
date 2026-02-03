import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Verifica membership dell'utente corrente
        const userMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!userMembership) {
            return new Response('Access denied', { status: 403 });
        }

        const members = await prisma.membership.findMany({
            where: { organizationId: orgId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        });

        return NextResponse.json({ members });

    } catch (error) {
        console.error('Fetch Members Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { email, role } = body;

        // Solo OWNER e ADMIN possono invitare
        const userMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!userMembership || !['OWNER', 'ADMIN'].includes(userMembership.role)) {
            return new NextResponse('Only owners and admins can invite members', { status: 403 });
        }

        // Verifica se l'utente esiste già nel sistema
        const targetUser = await prisma.user.findUnique({
            where: { email }
        });

        if (!targetUser) {
            // Se non esiste, in una versione completa invieremmo un invito email
            // Per ora restituiamo errore o creiamo placeholder (ma meglio errore in questo sample)
            return new NextResponse('User not found. Invite system not implemented yet.', { status: 404 });
        }

        // Verifica se è già membro
        const existingMembership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: targetUser.id,
                    organizationId: orgId
                }
            }
        });

        if (existingMembership) {
            return new NextResponse('User is already a member', { status: 400 });
        }

        const membership = await prisma.membership.create({
            data: {
                organizationId: orgId,
                userId: targetUser.id,
                role: role as Role || Role.MEMBER,
                status: 'ACTIVE' // Per ora aggiungiamo direttamente
            }
        });

        return NextResponse.json(membership);

    } catch (error) {
        console.error('Invite Member Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
