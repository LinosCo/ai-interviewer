import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { scrapeUrl } from '@/lib/scraping';
import { NextResponse } from 'next/server';
import Sitemapper from 'sitemapper';
import { indexKnowledgeSource } from '@/lib/kb/semantic-search';


function getMainLanguageUrls(urls: string[]): string[] {
    const buckets: Record<string, string[]> = { root: [] };

    for (const url of urls) {
        try {
            const pathname = new URL(url).pathname;
            // Match /en/, /it/, /fr-CA/ etc. at start of path
            const match = pathname.match(/^\/([a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?)(\/|$)/);
            if (match) {
                const lang = match[1].toLowerCase();
                if (!buckets[lang]) buckets[lang] = [];
                buckets[lang].push(url);
            } else {
                buckets.root.push(url);
            }
        } catch (e) {
            buckets.root.push(url);
        }
    }

    // Find the largest bucket - assuming it represents the main language
    let bestLang = 'root';
    let maxCount = buckets.root.length;

    Object.entries(buckets).forEach(([lang, items]) => {
        if (lang === 'root') return;
        if (items.length > maxCount) {
            bestLang = lang;
            maxCount = items.length;
        }
    });

    return buckets[bestLang];
}

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

        // Filter for main language
        const filteredSites = getMainLanguageUrls(sites);

        // Limit to prevent abuse in demo/MVP (increased to 100)
        const limitedSites = filteredSites.slice(0, 100);

        // Process sequentially (or in small batches) to avoid rate limits/overload
        // For MVP we just trigger scraping for the first few and return success
        // In a real app, this should be a background job (BullMQ, Inngest, etc.)

        // Background-ish processing: we don't 'await' all of them if we want to respond fast
        // But for consistency, let's process them and return the count
        let processedCount = 0;
        for (const siteUrl of limitedSites) {
            try {
                const scraped = await scrapeUrl(siteUrl);
                const ks = await prisma.knowledgeSource.create({
                    data: {
                        botId,
                        type: 'url',
                        title: scraped.title,
                        content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`,
                    }
                });
                // Fire-and-forget embedding
                indexKnowledgeSource(ks.id, ks.title, ks.content)
                    .catch(err => console.error('[sitemap] embedding failed:', err));
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
