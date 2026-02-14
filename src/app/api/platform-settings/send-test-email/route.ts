import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, email: true }
        });

        if (currentUser?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const to = typeof body.to === 'string' ? body.to.trim() : '';

        if (!to || !to.includes('@')) {
            return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 });
        }

        const now = new Date();
        const smtpHost = typeof body.smtpHost === 'string' ? body.smtpHost.trim() : '';
        const smtpPort = typeof body.smtpPort === 'number' ? body.smtpPort : null;
        const smtpSecure = typeof body.smtpSecure === 'boolean' ? body.smtpSecure : null;
        const smtpUser = typeof body.smtpUser === 'string' ? body.smtpUser.trim() : '';
        const smtpPass = typeof body.smtpPass === 'string' ? body.smtpPass : '';
        const smtpFromEmail = typeof body.smtpFromEmail === 'string' ? body.smtpFromEmail.trim() : '';

        const result = await sendEmail({
            to,
            subject: '[Business Tuner] Test configurazione email',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                    <h2>Test email riuscito</h2>
                    <p>Questa è una email di test inviata da Business Tuner.</p>
                    <p><strong>Data:</strong> ${now.toISOString()}</p>
                    <p><strong>Inviata da:</strong> ${currentUser?.email || 'admin'}</p>
                </div>
            `,
            smtpOverrides: {
                host: smtpHost || null,
                port: smtpPort,
                secure: smtpSecure,
                user: smtpUser || null,
                pass: smtpPass || null,
                fromEmail: smtpFromEmail || null
            }
        });

        if (!result.success) {
            return NextResponse.json({
                error: 'Failed to send test email',
                details: typeof result.error === 'string' ? result.error : ((result.error as any)?.message || null)
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, to, providerResult: result.data || null });
    } catch (error: any) {
        console.error('[platform-settings/send-test-email] error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to send test email' },
            { status: 500 }
        );
    }
}
