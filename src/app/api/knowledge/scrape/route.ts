import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { scrapeUrl } from '@/lib/scraping';
import { z } from 'zod';

const scrapeSchema = z.object({
    botId: z.string(),
    url: z.string().url()
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const validation = scrapeSchema.safeParse(body);

        if (!validation.success) {
            return new Response('Invalid request', { status: 400 });
        }

        const { botId, url } = validation.data;

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

        // Check if organization exists and has members (or handle personal projects if needed, but for now safe navigation)
        if (!bot || !bot.project.organization || bot.project.organization.members.length === 0) {
            return new Response('Bot not found or unauthorized', { status: 404 });
        }

        // Perform scraping
        const scrapedData = await scrapeUrl(url);

        // Save to KnowledgeSource
        const knowledgeSource = await prisma.knowledgeSource.create({
            data: {
                botId,
                type: 'url',
                title: scrapedData.title,
                content: `URL: ${scrapedData.url}\n\nTitle: ${scrapedData.title}\n\n${scrapedData.content}`,
            }
        });

        return Response.json(knowledgeSource);

    } catch (error: any) {
        console.error('Scrape API Error:', error);
        return new Response(error.message || 'Internal Server Error', { status: 500 });
    }
}
