import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login', // We will create this page later
        // newUser: '/register',
    },
    providers: [], // Configured in auth.ts
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            }
            return true;
        },
        async signIn() {
            return true; // Allow sign in
        },
        async redirect({ url, baseUrl }) {
            // Always redirect to dashboard after login
            if (url.startsWith(baseUrl)) return url;
            if (url.startsWith('/')) return `${baseUrl}${url}`;
            return baseUrl + '/dashboard';
        },
        jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        },
        session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                (session.user as any).role = token.role;
            }
            return session;
        }
    },
} satisfies NextAuthConfig;
