import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

interface SourceAggregation {
    domain: string;
    url: string;
    count: number;
    prompts: string[];
    platforms: string[];
}

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const configId = searchParams.get('configId');
        const organizationId = searchParams.get('organizationId');

        if (!configId && !organizationId) {
            return Response.json({ error: 'configId or organizationId required' }, { status: 400 });
        }

        // Fetch all completed scans with their responses
        const scans = await prisma.visibilityScan.findMany({
            where: {
                ...(configId ? { configId } : {}),
                ...(organizationId ? { visibilityConfig: { organizationId } } : {}),
                status: 'completed'
            },
            include: {
                responses: {
                    include: {
                        prompt: {
                            select: { text: true }
                        }
                    }
                }
            },
            orderBy: { completedAt: 'desc' },
            take: 50 // Limit to last 50 scans for performance
        });

        // Aggregate sources
        const sourceMap = new Map<string, {
            url: string;
            count: number;
            prompts: Set<string>;
            platforms: Set<string>;
        }>();

        scans.forEach(scan => {
            scan.responses.forEach(response => {
                if (!response.sourcesCited || response.sourcesCited.length === 0) return;

                response.sourcesCited.forEach(source => {
                    const domain = extractDomain(source);

                    if (!sourceMap.has(domain)) {
                        sourceMap.set(domain, {
                            url: source,
                            count: 0,
                            prompts: new Set(),
                            platforms: new Set()
                        });
                    }

                    const entry = sourceMap.get(domain)!;
                    entry.count++;
                    entry.prompts.add(response.prompt.text);
                    entry.platforms.add(response.platform);
                });
            });
        });

        // Convert to array and sort by count
        const sources: SourceAggregation[] = Array.from(sourceMap.entries())
            .map(([domain, data]) => ({
                domain,
                url: data.url,
                count: data.count,
                prompts: Array.from(data.prompts).slice(0, 3), // Top 3 prompts
                platforms: Array.from(data.platforms)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 sources

        return Response.json({
            sources,
            totalScans: scans.length,
            totalSources: sourceMap.size
        });

    } catch (error: any) {
        console.error('Error fetching top sources:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
