'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState: string | null | undefined,
    formData: FormData,
): Promise<string | null> {
    try {
        const result = await signIn('credentials', {
            email: formData.get('email'),
            password: formData.get('password'),
            redirect: false,
        });

        // If we get here without error, login was successful
        console.log('Login successful, result:', result);
        return null;
    } catch (error: any) {
        // Check if it's a redirect error (NEXT_REDIRECT)
        if (error?.digest?.startsWith('NEXT_REDIRECT')) {
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
