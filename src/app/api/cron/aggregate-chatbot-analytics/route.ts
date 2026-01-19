import { aggregateChatbotAnalytics } from '@/lib/chatbot/analytics-aggregator';

export async function GET(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        await aggregateChatbotAnalytics();
        return Response.json({ success: true });
    } catch (error) {
        console.error('Cron job failed:', error);
        return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
