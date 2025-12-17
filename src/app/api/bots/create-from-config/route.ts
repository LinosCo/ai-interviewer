import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

function generateSlug(name: string): string {
    const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);

    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { ownedProjects: true }
        });

        if (!user) {
            return new Response('User not found', { status: 404 });
        }

        const config = await req.json();

        // Get or create default project
        let project = user.ownedProjects[0];
        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: 'Il mio workspace',
                    ownerId: user.id
                }
            });
        }

        // Create the bot with topics
        const slug = generateSlug(config.name || 'intervista');

        const bot = await prisma.bot.create({
            data: {
                projectId: project.id,
                slug,
                name: config.name || 'Nuova intervista',
                description: config.researchGoal,
                researchGoal: config.researchGoal,
                targetAudience: config.targetAudience,
                language: config.language || 'it',
                tone: config.tone,
                maxDurationMins: config.maxDurationMins || 10,
                introMessage: config.introMessage,
                // Create topics
                topics: {
                    create: config.topics.map((topic: any, index: number) => ({
                        orderIndex: index,
                        label: topic.label,
                        description: topic.description,
                        subGoals: topic.subGoals,
                        maxTurns: topic.maxTurns || 4
                    }))
                }
            },
            include: {
                topics: true
            }
        });

        return Response.json({
            id: bot.id,
            slug: bot.slug,
            name: bot.name
        });

    } catch (error: any) {
        console.error('Create Bot Error:', error);
        return new Response(error.message || 'Creation failed', { status: 500 });
    }
}
