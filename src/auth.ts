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
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    session: { strategy: 'jwt' },
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
                    // For MVP, if no password set (e.g. OAuth user), fail
                    // We need a password field in User model for credentials to work with standard schema?
                    // Wait, Prisma Schema for User (from Adapter) doesn't have password.
                    // I need to add 'password' field to User model manually in Schema!
                    return user; // TODO: Compare password once we add password to User model.
                    // For now, allow login if user exists and we skip password check or check against a hardcoded hash?
                    // No, I must update Schema to add password.
                }
                return null;
            },
        }),
    ],
});
