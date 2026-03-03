'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function authenticate(
    prevState: string | null | undefined,
    formData: FormData,
): Promise<string | null> {
    try {
        const email = (formData.get('email') as string | null)?.toLowerCase().trim();
        const password = formData.get('password');

        if (email) {
            const user = await prisma.user.findUnique({
                where: { email },
                select: { emailVerified: true }
            });

            if (user && !user.emailVerified) {
                return 'Prima di accedere devi confermare la tua email dal link ricevuto.';
            }
        }

        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        // If we get here without error, login was successful
        console.log('Login successful');
        return null;
    } catch (error: unknown) {
        const unknownError = error as { digest?: string };
        // Check if it's a redirect error (NEXT_REDIRECT)
        if (unknownError?.digest?.startsWith('NEXT_REDIRECT')) {
            console.log('Redirect error caught (this is actually success)');
            return null;
        }

        // Handle actual authentication errors
        if (error instanceof AuthError) {
            console.error('AuthError:', error.type);
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }

        // For other errors, log and return generic message
        console.error('Unexpected error during authentication:', error);
        return 'Authentication failed.';
    }
}
