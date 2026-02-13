import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { testEmailProviderConnection } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        if (currentUser?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const result = await testEmailProviderConnection({
            smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost : null,
            smtpPort: typeof body.smtpPort === 'number' ? body.smtpPort : null,
            smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : null,
            smtpUser: typeof body.smtpUser === 'string' ? body.smtpUser : null,
            smtpPass: typeof body.smtpPass === 'string' ? body.smtpPass : null
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[platform-settings/test-connection] error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to validate email connection' },
            { status: 500 }
        );
    }
}
