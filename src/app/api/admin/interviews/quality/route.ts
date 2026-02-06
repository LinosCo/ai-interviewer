import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getInterviewQualityDashboardData } from '@/lib/interview/quality-dashboard';

function parsePositiveInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function parseBooleanFlag(value: string | null): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { role: true }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const windowHours = parsePositiveInt(searchParams.get('windowHours'), 24);
        const maxTurns = parsePositiveInt(searchParams.get('maxTurns'), 5000);
        const botId = (searchParams.get('botId') || '').trim() || undefined;
        const includeAiReview = parseBooleanFlag(searchParams.get('refresh')) || parseBooleanFlag(searchParams.get('includeAi'));

        const data = await getInterviewQualityDashboardData({
            windowHours,
            maxTurns,
            botId,
            includeAiReview
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching interview quality dashboard:', error);
        return NextResponse.json(
            { error: 'Failed to fetch interview quality dashboard' },
            { status: 500 }
        );
    }
}
