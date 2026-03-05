import { CopilotAlertEngine } from '@/lib/copilot/alert-engine';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/check-alerts
 *
 * Daily cron job that checks all organizations for alert conditions:
 * - Traffic drop >20% week-over-week
 * - Negative LLM mentions in last 7 days
 * - Unresolved knowledge gaps >7 days old
 * - Google integrations with no data >14 days
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await CopilotAlertEngine.runChecksForAllOrgs();
    console.log('[check-alerts] Done:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[check-alerts] Failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
