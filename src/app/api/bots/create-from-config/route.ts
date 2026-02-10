import { auth } from '@/auth';
import { canPublishBot } from '@/lib/usage';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { scrapeUrl } from '@/lib/scraping';

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
        console.log('🔐 [CREATE-BOT] Starting authentication check');
        const session = await auth();

        console.log('🔐 [CREATE-BOT] Session check:', {
            hasSession: !!session,
            hasUser: !!session?.user
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
            found: !!user,
            projectsCount: user?.ownedProjects?.length || 0
        });

        if (!user) {
            console.error('❌ [CREATE-BOT] User not found in database');
            return new Response('User not found', { status: 404 });
        }

        const config = await req.json();

        // Use provided projectId or get default project
        let projectId = config.projectId;

        if (!projectId) {
            const { getOrCreateDefaultOrganization } = await import('@/lib/organizations');
            const organization = await getOrCreateDefaultOrganization(user.id);

            // Create default project linked to this org
            let project = await prisma.project.findFirst({
                where: { ownerId: user.id, organizationId: organization.id }
            });

            if (!project) {
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

        // Get organizationId from project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true, name: true, id: true }
        });

        if (!project) {
            return new Response('Project not found', { status: 404 });
        }

        if (!project.organizationId) {
            const { getOrCreateDefaultOrganization } = await import('@/lib/organizations');
            const organization = await getOrCreateDefaultOrganization(user.id);

            await prisma.project.update({
                where: { id: projectId },
                data: { organizationId: organization.id }
            });
            project.organizationId = organization.id;
        }

        console.log('🎯 [CREATE-BOT] Checking usage limits for org');

        const publishCheck = await canPublishBot(project.organizationId);
        console.log('📊 [CREATE-BOT] Usage check result:', {
            allowed: publishCheck.allowed,
            reason: publishCheck.reason
        });

        if (!publishCheck.allowed) {
        console.log('⛔ [CREATE-BOT] Publishing not allowed');
            return new Response(JSON.stringify({
                error: 'LIMIT_REACHED',
                message: publishCheck.reason
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('✅ [CREATE-BOT] Usage check passed, proceeding to create bot');

        // Create the bot with topics/KB based on type
        const slug = generateSlug(config.name || 'intervista');
        const botType = config.botType || 'interview';
        const isChatbot = botType === 'chatbot';
        const botConfig = config.config || {}; // Chatbot config wrapper

        let botData: any = {
            projectId,
            slug,
            name: config.name || 'Nuova intervista',
            status: 'PUBLISHED',
            description: config.researchGoal || botConfig.description,
            language: config.language || 'it',
            botType: botType,
            primaryColor: isChatbot ? (botConfig.primaryColor || '#F59E0B') : '#F59E0B',
        };

        if (isChatbot) {
            // Process knowledge sources (scrape URLs if content is placeholder)
            const processedSources = [];
            if (botConfig.knowledgeSources) {
                for (const k of botConfig.knowledgeSources) {
                    if (k.type === 'url' && (k.content === 'To be scraped' || !k.content)) {
                        try {
                            const scraped = await scrapeUrl(k.title); // Title holds the URL in the simplistic wizard
                            processedSources.push({
                                title: scraped.title,
                                content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`,
                                type: 'url'
                            });
                        } catch (e) {
                            console.error(`Failed to scrape ${k.title}`, e);
                            // Add as failed or skip? Add as basic link
                            processedSources.push({
                                title: k.title,
                                content: `URL: ${k.title} (Scraping failed)`,
                                type: 'url'
                            });
                        }
                    } else {
                        processedSources.push({
                            title: k.title,
                            content: k.content,
                            type: k.type || 'text'
                        });
                    }
                }
            }

            // Chatbot specific fields
            const hasLeadFields = Array.isArray(botConfig.candidateDataFields) && botConfig.candidateDataFields.length > 0;
            botData = {
                ...botData,
                tone: botConfig.tone,
                enablePageContext: true,
                leadCaptureStrategy: botConfig.leadCaptureStrategy || 'after_3_msgs',
                candidateDataFields: botConfig.candidateDataFields,
                collectCandidateData: hasLeadFields, // Auto-enable when lead fields are configured
                introMessage: botConfig.welcomeMessage,
                bubblePosition: botConfig.bubblePosition || 'bottom-right',
                knowledgeSources: {
                    create: processedSources
                }
            };
        } else {
            // Interview specific fields
            botData = {
                ...botData,
                researchGoal: config.researchGoal,
                targetAudience: config.targetAudience,
                maxDurationMins: config.maxDurationMins || 10,
                introMessage: config.introMessage,
                useWarmup: false,
                topics: {
                    create: config.topics?.map((topic: any, index: number) => ({
                        orderIndex: index,
                        label: topic.label,
                        description: topic.description,
                        subGoals: topic.subGoals,
                        maxTurns: topic.maxTurns || 4
                    }))
                }
            };
        }

        console.log('🤖 [CREATE-BOT] Creating bot with data:', {
            name: botData.name,
            botType: botData.botType,
            projectId: botData.projectId,
            slug: botData.slug,
            hasTopics: !!botData.topics,
            topicsCount: botData.topics?.create?.length || 0,
            hasKnowledgeSources: !!botData.knowledgeSources,
            knowledgeSourcesCount: botData.knowledgeSources?.create?.length || 0
        });

        const bot = await prisma.bot.create({
            data: botData,
            include: {
                topics: true,
                knowledgeSources: true
            }
        });

        console.log('🎉 [CREATE-BOT] Bot created successfully:', {
            botId: bot.id,
            slug: bot.slug,
            name: bot.name
        });

        return Response.json({
            botId: bot.id,  // Frontend expects botId
            id: bot.id,
            slug: bot.slug,
            name: bot.name
        });

    } catch (error: any) {
        console.error('❌ [CREATE-BOT] Error details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
        return new Response(JSON.stringify({
            error: error.code || 'CREATION_FAILED',
            message: error.message || 'Creation failed'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
