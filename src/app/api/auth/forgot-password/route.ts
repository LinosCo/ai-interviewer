import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email richiesta' },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        // Always return success to prevent email enumeration
        // But only send email if user exists
        if (user) {
            // Generate secure random token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

            // Invalidate any existing tokens for this user
            await prisma.passwordResetToken.updateMany({
                where: {
                    userId: user.id,
                    used: false,
                },
                data: {
                    used: true,
                },
            });

            // Create new reset token
            await prisma.passwordResetToken.create({
                data: {
                    token: resetToken,
                    userId: user.id,
                    expiresAt,
                },
            });

            // Send reset email
            const sendResult = await sendPasswordResetEmail(user.email, resetToken);
            if (!sendResult.success) {
                const reason =
                    typeof sendResult.error === 'string'
                        ? sendResult.error
                        : (sendResult.error as any)?.message || 'Unknown email error';
                console.error('[forgot-password] password reset email failed:', {
                    userId: user.id,
                    email: user.email,
                    reason
                });
            }
        }

        // Always return success message
        return NextResponse.json({
            message: 'Se l\'email esiste nel nostro sistema, riceverai le istruzioni per reimpostare la password.',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'Si è verificato un errore. Riprova più tardi.' },
            { status: 500 }
        );
    }
}
