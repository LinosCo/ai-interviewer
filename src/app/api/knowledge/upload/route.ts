import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const botId = formData.get('botId') as string;

        if (!file || !botId) {
            return new Response('Missing file or botId', { status: 400 });
        }

        // Verify ownership
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                project: {
                    include: {
                        organization: {
                            include: {
                                members: {
                                    where: {
                                        user: { email: session.user.email }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!bot || !bot.project.organization || bot.project.organization.members.length === 0) {
            return new Response('Bot not found or unauthorized', { status: 404 });
        }

        // Read file content
        const text = await file.text();
        const type = file.name.endsWith('.json') ? 'json' : 'text';

        // Save to KnowledgeSource
        const knowledgeSource = await prisma.knowledgeSource.create({
            data: {
                botId,
                type: 'file',
                title: file.name,
                content: text
            }
        });

        return NextResponse.json(knowledgeSource);

    } catch (error: any) {
        console.error('Upload API Error:', error);
        return new Response(error.message || 'Internal Server Error', { status: 500 });
    }
}
