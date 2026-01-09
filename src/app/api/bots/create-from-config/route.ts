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
        console.log('🔐 [CREATE-BOT] Starting authentication check...');
        const session = await auth();

        console.log('🔐 [CREATE-BOT] Session:', {
            hasSession: !!session,
            hasUser: !!session?.user,
            email: session?.user?.email,
            userId: session?.user?.id
        });

        if (!session?.user?.email) {
            console.error('❌ [CREATE-BOT] Unauthorized: No session or email');
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { ownedProjects: true }
        });

        console.log('👤 [CREATE-BOT] User lookup:', {
            email: session.user.email,
            found: !!user,
            userId: user?.id,
            projectsCount: user?.ownedProjects?.length || 0
        });

        if (!user) {
            console.error('❌ [CREATE-BOT] User not found in database:', session.user.email);
            return new Response('User not found', { status: 404 });
        }

        const config = await req.json();

        // Use provided projectId or get default project
        let projectId = config.projectId;

        if (!projectId) {
            // Find a valid project (one that has an organization)
            let project = await prisma.project.findFirst({
                where: {
                    ownerId: user.id,
                    organizationId: { not: null }
                }
            });

            if (!project) {
                // Determine organization
                let organization = await prisma.organization.findFirst({
                    where: { members: { some: { userId: user.id } } }
                });

                // If no org, create a Personal Organization
                if (!organization) {
                    const orgName = user.name ? `${user.name}'s Org` : 'My Organization';
                    const slug = user.name
                        ? `${user.name.toLowerCase().replace(/\s+/g, '-')}-${randomBytes(2).toString('hex')}`
                        : `org-${randomBytes(4).toString('hex')}`;

                    organization = await prisma.organization.create({
                        data: {
                            name: orgName,
                            slug: slug,
                            members: {
                                create: {
                                    userId: user.id,
                                    role: 'OWNER'
                                }
                            }
                        }
                    });
                }

                // Create default project linked to this org
                project = await prisma.project.create({
                    data: {
                        name: 'Il mio workspace',
                        ownerId: user.id,
                        organizationId: organization.id
                    }
                });
            }
            projectId = project.id;
        } else {
            // Verify access (basic check: user owns it or has access via ProjectAccess)
            const hasAccess = user.ownedProjects.some(p => p.id === projectId) ||
                await prisma.projectAccess.findUnique({
                    where: { userId_projectId: { userId: user.id, projectId } }
                });

            if (!hasAccess) {
                return new Response('Forbidden: Acceduto negato al progetto', { status: 403 });
            }
        }

        // Check usage limits
        const { canPublishBot } = require('@/lib/usage');

        // Get organizationId from project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true, name: true, id: true }
        });

        console.log('📁 [CREATE-BOT] Project lookup:', {
            projectId,
            found: !!project,
            hasOrganization: !!project?.organizationId,
            projectName: project?.name
        });

        if (!project?.organizationId) {
            // Project exists but has no organization - create one
            console.log('🏢 [CREATE-BOT] Project has no organization, creating one...');

            const orgName = user.name ? `${user.name}'s Organization` : 'My Organization';
            const orgSlug = user.name
                ? `${user.name.toLowerCase().replace(/\s+/g, '-')}-${randomBytes(2).toString('hex')}`
                : `org-${randomBytes(4).toString('hex')}`;

            const organization = await prisma.organization.create({
                data: {
                    name: orgName,
                    slug: orgSlug,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER'
                        }
                    }
                }
            });

            // Link project to organization
            await prisma.project.update({
                where: { id: projectId },
                data: { organizationId: organization.id }
            });

            console.log('✅ [CREATE-BOT] Organization created and linked:', organization.id);

            // Update project variable
            project.organizationId = organization.id;
        }

        const publishCheck = await canPublishBot(project.organizationId);
        if (!publishCheck.allowed) {
            return new Response(JSON.stringify({
                error: 'LIMIT_REACHED',
                message: publishCheck.reason
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create the bot with topics
        const slug = generateSlug(config.name || 'intervista');

        const bot = await prisma.bot.create({
            data: {
                projectId,
                slug,
                name: config.name || 'Nuova intervista',
                status: 'PUBLISHED',
                description: config.researchGoal,
                researchGoal: config.researchGoal,
                targetAudience: config.targetAudience,
                language: config.language || 'it',
                tone: config.tone,
                maxDurationMins: config.maxDurationMins || 10,
                introMessage: config.introMessage,
                primaryColor: '#F59E0B', // Force Amber as default instead of Prisma default (Indigo)
                useWarmup: false,         // Disable warmup by default as requested
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
