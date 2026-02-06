import { getInterviewQualityDashboardData } from '@/lib/interview/quality-dashboard';

function parseEnvInt(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const windowHours = parseEnvInt(process.env.INTERVIEW_ALERT_WINDOW_HOURS, 24);
        const maxTurns = parseEnvInt(process.env.INTERVIEW_ALERT_MAX_TURNS, 6000);

        const dashboard = await getInterviewQualityDashboardData({
            windowHours,
            maxTurns
        });

        const actionableAlerts = dashboard.alerts.filter(alert => alert.severity !== 'info');
        if (actionableAlerts.length === 0) {
            return Response.json({
                success: true,
                sent: false,
                reason: 'No actionable interview quality alerts',
                generatedAt: dashboard.generatedAt
            });
        }

        const webhookUrl = process.env.INTERVIEW_QUALITY_ALERT_WEBHOOK_URL;
        if (!webhookUrl) {
            return Response.json({
                success: true,
                sent: false,
                reason: 'Webhook URL not configured',
                alerts: actionableAlerts
            });
        }

        const payload = {
            event: 'interview_quality_alert',
            generatedAt: dashboard.generatedAt,
            windowHours: dashboard.windowHours,
            summary: {
                passRate: dashboard.current.passRate,
                avgScore: dashboard.current.avgScore,
                gateTriggerRate: dashboard.current.gateTriggerRate,
                fallbackRate: dashboard.current.fallbackRate,
                completionGuardRate: dashboard.current.completionGuardRate,
                evaluatedTurns: dashboard.current.evaluatedTurns
            },
            delta: dashboard.delta,
            alerts: actionableAlerts.slice(0, 10)
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const responseBody = await response.text();
            throw new Error(`Webhook returned ${response.status}: ${responseBody}`);
        }

        return Response.json({
            success: true,
            sent: true,
            alertCount: actionableAlerts.length
        });
    } catch (error) {
        console.error('Interview quality alert cron failed:', error);
        return Response.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
