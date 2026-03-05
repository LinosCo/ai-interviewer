import { ChatbotGapToContentBridge } from '@/lib/cms/chatbot-gap-bridge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/gap-to-content
 *
 * Daily cron job that converts unresolved chatbot knowledge gaps into
 * CMS content suggestions. Runs after /api/cron/detect-gaps.
 *
 * For each project with chatbot bots:
 *   1. Finds unresolved high/medium-priority KnowledgeGap records
 *   2. Batches them (up to 5 per suggestion)
 *   3. Generates a CMSSuggestion via CMSSuggestionGenerator (CREATE_FAQ or CREATE_PAGE)
 *   4. Marks processed gaps as 'bridged'
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await ChatbotGapToContentBridge.processAllProjects();
        console.log('[gap-to-content] Done:', result);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('[gap-to-content] Failed:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
