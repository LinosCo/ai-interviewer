import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email';

function sanitizeNextPath(value: string | null): string | null {
    if (!value) return null;
    return value.startsWith('/') ? value : null;
}

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token');
    const rawEmail = request.nextUrl.searchParams.get('email');
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'));

    const redirectToLogin = (params: Record<string, string>) => {
        const url = new URL('/login', request.url);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        if (nextPath) {
            url.searchParams.set('next', nextPath);
        }
        return NextResponse.redirect(url);
    };

    if (!token || !rawEmail) {
        return redirectToLogin({ verified: '0', reason: 'invalid_link' });
    }

    const email = rawEmail.toLowerCase().trim();

    try {
        const verificationToken = await prisma.verificationToken.findUnique({
            where: {
                identifier_token: {
                    identifier: email,
                    token
                }
            }
        });

        if (!verificationToken) {
            return redirectToLogin({ verified: '0', reason: 'invalid_token' });
        }

        if (verificationToken.expires < new Date()) {
            await prisma.verificationToken.delete({
                where: {
                    identifier_token: {
                        identifier: email,
                        token
                    }
                }
            }).catch(() => null);

            return redirectToLogin({ verified: '0', reason: 'expired_token' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, emailVerified: true }
        });

        if (!user) {
            return redirectToLogin({ verified: '0', reason: 'user_not_found' });
        }

        await prisma.$transaction(async (tx) => {
            if (!user.emailVerified) {
                await tx.user.update({
                    where: { id: user.id },
                    data: { emailVerified: new Date() }
                });
            }

            await tx.verificationToken.deleteMany({
                where: { identifier: email }
            });
        });

        if (!user.emailVerified) {
            await sendWelcomeEmail({
                to: user.email,
                userName: user.name
            }).catch((error) => {
                console.error('Welcome email error after verification:', error);
            });
        }

        return redirectToLogin({ verified: '1' });
    } catch (error) {
        console.error('Email verification error:', error);
        return redirectToLogin({ verified: '0', reason: 'server_error' });
    }
}
