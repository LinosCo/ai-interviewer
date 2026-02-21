'use server';

import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { PlanType, PLANS } from '@/config/plans';
import { sendAccountVerificationEmail, sendSystemNotification } from '@/lib/email';
import { syncLegacyProjectAccessForOrganization } from '@/lib/domain/workspace';

export async function registerUser(prevState: string | undefined, formData: FormData) {
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const password = formData.get('password') as string;
    const name = (formData.get('name') as string)?.trim();
    const companyName = (formData.get('companyName') as string)?.trim();
    const vatId = (formData.get('vatId') as string)?.trim();
    const plan = formData.get('plan') as string;

    if (!email || !password || !name || !companyName) {
        return 'Tutti i campi obbligatori devono essere compilati.';
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return 'Questo indirizzo email è già registrato.';
        }

        const hashedPassword = await hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore
        const trialCredits = PLANS[PlanType.TRIAL].monthlyCredits;

        // Create user, organization and membership in a transaction
        const transactionResult = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                },
            });

            // Set default trial ending in 14 days
            const trialDays = 14;
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + trialDays);

            const org = await tx.organization.create({
                data: {
                    name: companyName,
                    vatId: vatId || null,
                    plan: 'TRIAL',
                    monthlyCreditsLimit: BigInt(trialCredits),
                    slug: `org-${Math.random().toString(36).substring(2, 10)}`,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER',
                            status: 'ACTIVE',
                            acceptedAt: new Date(),
                            joinedAt: new Date()
                        },
                    },
                    subscription: {
                        create: {
                            tier: 'TRIAL',
                            status: 'TRIALING',
                            currentPeriodEnd: trialEnd,
                            trialEndsAt: trialEnd,
                        }
                    },
                    projects: {
                        create: {
                            name: companyName,
                            ownerId: user.id,
                            isPersonal: false
                        }
                    }
                },
            });

            await tx.verificationToken.deleteMany({
                where: { identifier: email }
            });

            await tx.verificationToken.create({
                data: {
                    identifier: email,
                    token: verificationToken,
                    expires: verificationExpires
                }
            });

            return { user, org };
        });

        await syncLegacyProjectAccessForOrganization(transactionResult.org.id);

        await sendSystemNotification(
            'Nuova Registrazione Utente',
            `<p>Un nuovo utente si è registrato: <b>${name}</b> (${email}).</p>
             <p>Azienda: <b>${companyName}</b>${vatId ? ` (P.IVA: ${vatId})` : ''}</p>
             <p>Piano selezionato: ${plan || 'FREE'}</p>`
        );

        const verificationEmailResult = await sendAccountVerificationEmail({
            to: email,
            userName: name,
            token: verificationToken,
            // New users should start with the 14-day trial without forced payment redirect.
            nextPath: undefined
        });
        if (!verificationEmailResult.success) {
            const reason =
                typeof verificationEmailResult.error === 'string'
                    ? verificationEmailResult.error
                    : (verificationEmailResult.error as any)?.message || 'Unknown email error';
            throw new Error(`Verification email send failed: ${reason}`);
        }

    } catch (error) {
        console.error('Registration error:', error);
        if (error instanceof Error && error.message.includes('Verification email send failed:')) {
            return 'Account creato, ma invio email di conferma fallito. Contatta supporto o riprova più tardi.';
        }
        return 'Registration failed.';
    }

    redirect('/login?verification=sent');
}
