import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

async function getUser(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        return user;
    } catch (error) {
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: 'jwt' },
    basePath: '/api/auth',
    trustHost: true,
    debug: process.env.NODE_ENV === 'development',
    logger: {
        error(error) {
            // Invalid credentials are a normal user-flow outcome, not an operational error.
            const errorType = typeof error === 'object' && error && 'type' in error
                ? String((error as { type?: string }).type || '')
                : '';
            const errorName = typeof error === 'object' && error && 'name' in error
                ? String((error as { name?: string }).name || '')
                : '';
            const errorMessage = typeof error === 'object' && error && 'message' in error
                ? String((error as { message?: string }).message || '')
                : String(error || '');

            if (errorType === 'CredentialsSignin' || errorName === 'CredentialsSignin' || errorMessage.includes('CredentialsSignin')) {
                return;
            }
            console.error('[auth][error]', error);
        },
        warn(message) {
            console.warn('[auth][warn]', message);
        },
        debug(message) {
            if (process.env.NODE_ENV === 'development') {
                console.debug('[auth][debug]', message);
            }
        },
    },
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password || '');
                    if (passwordsMatch) return user;

                    // For now, allow login if user exists and we skip password check or check against a hardcoded hash?
                    // No, I must update Schema to add password.
                }
                return null;
            },
        }),
    ],
});
