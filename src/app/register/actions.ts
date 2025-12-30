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
    const plan = formData.get('plan') as string;

    if (!email || !password) {
        return 'Email and password are required.';
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return 'User already exists.';
        }

        const hashedPassword = await hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });

        // Auto-login after registration
        await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        await sendSystemNotification(
            'Nuova Registrazione Utente',
            `<p>Un nuovo utente si è registrato: <b>${name}</b> (${email}).</p>
             <p>Piano selezionato: ${plan || 'FREE'}</p>`
        );

    } catch (error) {
        console.error('Registration error:', error);
        return 'Registration failed.';
    }

    // Redirect logic
    if (plan && ['STARTER', 'PRO', 'BUSINESS'].includes(plan)) {
        redirect(`/api/stripe/checkout?tier=${plan}`);
    } else {
        redirect('/dashboard');
    }
}
