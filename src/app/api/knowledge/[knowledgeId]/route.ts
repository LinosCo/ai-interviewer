
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface Params {
    params: {
        knowledgeId: string;
    };
}

export async function GET(req: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { knowledgeId } = params;

        if (!knowledgeId) {
            return new Response('Missing knowledgeId', { status: 400 });
        }

        const source = await prisma.knowledgeSource.findUnique({
            where: { id: knowledgeId },
            include: {
                bot: {
                    include: {
                        project: {
                            include: {
                                organization: {
                                    include: {
                                        members: {
                                            where: { user: { email: session.user.email } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!source || !source.bot.project.organization || source.bot.project.organization.members.length === 0) {
            return new Response('Not found or unauthorized', { status: 404 });
        }

        return NextResponse.json({
            id: source.id,
            title: source.title,
            content: source.content,
            type: source.type,
            createdAt: source.createdAt
        });

    } catch (error: any) {
        console.error('Error fetching knowledge source:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { knowledgeId } = params;

        // Verify ownership
        const source = await prisma.knowledgeSource.findUnique({
            where: { id: knowledgeId },
            include: {
                bot: {
                    include: {
                        project: {
                            include: {
                                organization: {
                                    include: {
                                        members: {
                                            where: { user: { email: session.user.email } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!source || !source.bot.project.organization || source.bot.project.organization.members.length === 0) {
            return new Response('Unauthorized', { status: 404 });
        }

        await prisma.knowledgeSource.delete({
            where: { id: knowledgeId }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting knowledge source:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
