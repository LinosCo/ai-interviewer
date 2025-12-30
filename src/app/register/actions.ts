'use server';

import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import { sendSystemNotification } from '@/lib/email';

export async function registerUser(prevState: string | undefined, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const companyName = formData.get('companyName') as string;
    const vatId = formData.get('vatId') as string;
    const plan = formData.get('plan') as string;
    const billing = formData.get('billing') as string;

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

        // Create user, organization and membership in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                },
            });

            const org = await tx.organization.create({
                data: {
                    name: companyName,
                    vatId: vatId || null,
                    slug: `org-${Math.random().toString(36).substring(2, 10)}`,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER',
                        },
                    },
                },
            });

            return { user, org };
        });

        // Auto-login after registration
        try {
            await signIn('credentials', {
                email,
                password,
                redirect: false,
            });
        } catch (signInError) {
            console.error('SignIn error during registration:', signInError);
            // We don't return here because the user is created, 
            // the redirect below will handle the rest or they can login manually.
        }

        await sendSystemNotification(
            'Nuova Registrazione Utente',
            `<p>Un nuovo utente si è registrato: <b>${name}</b> (${email}).</p>
             <p>Azienda: <b>${companyName}</b>${vatId ? ` (P.IVA: ${vatId})` : ''}</p>
             <p>Piano selezionato: ${plan || 'FREE'}</p>`
        );

    } catch (error) {
        console.error('Registration error:', error);
        return 'Registration failed.';
    }

    // Redirect logic
    if (plan && ['STARTER', 'PRO', 'BUSINESS'].includes(plan)) {
        redirect(`/api/stripe/checkout?tier=${plan}${billing ? `&billing=${billing}` : ''}`);
    } else {
        redirect('/dashboard');
    }
}
