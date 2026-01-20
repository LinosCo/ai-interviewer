import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { scrapeUrl } from '@/lib/scraping';
import { NextResponse } from 'next/server';
import Sitemapper from 'sitemapper';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { botId, url } = await req.json();

        if (!botId || !url) {
            return new Response('Missing botId or url', { status: 400 });
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
                                    where: { user: { email: session.user.email } }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!bot || !bot.project.organization || bot.project.organization.members.length === 0) {
            return new Response('Unauthorized', { status: 404 });
        }

        // Fetch Sitemap
        const sitemap = new Sitemapper();
        const { sites } = await sitemap.fetch(url);

        if (!sites || sites.length === 0) {
            return NextResponse.json({ error: 'Nessun URL trovato nella sitemap' }, { status: 400 });
        }

        // Limit to prevent abuse in demo/MVP
        const limitedSites = sites.slice(0, 50);

        // Process sequentially (or in small batches) to avoid rate limits/overload
        // For MVP we just trigger scraping for the first few and return success
        // In a real app, this should be a background job (BullMQ, Inngest, etc.)

        // Background-ish processing: we don't 'await' all of them if we want to respond fast
        // But for consistency, let's process them and return the count
        let processedCount = 0;
        for (const siteUrl of limitedSites) {
            try {
                const scraped = await scrapeUrl(siteUrl);
                await prisma.knowledgeSource.create({
                    data: {
                        botId,
                        type: 'url',
                        title: scraped.title,
                        content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`,
                    }
                });
                processedCount++;
            } catch (err) {
                console.error(`Failed sitesmap url scrape: ${siteUrl}`, err);
            }
        }

        return NextResponse.json({
            success: true,
            count: processedCount,
            totalFound: sites.length,
            message: `Indicizzazione completata per ${processedCount} pagine.`
        });

    } catch (error: any) {
        console.error('Sitemap API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
