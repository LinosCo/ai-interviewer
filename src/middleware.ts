import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const { auth } = NextAuth(authConfig);

// Create Ratelimiter if env vars are present
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    // Create a new ratelimiter, that allows 10 requests per 10 seconds
    ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(20, "10 s"), // Slightly more generous for stability
        analytics: true,
        prefix: "@upstash/ratelimit",
    });
}

export default auth(async (req) => {
    // Never rate-limit Auth.js endpoints, otherwise session refresh/login can fail
    // and appear as random logout.
    if (req.nextUrl.pathname.startsWith('/api/auth')) {
        return NextResponse.next();
    }

    // Only rate limit API routes
    if (ratelimit && req.nextUrl.pathname.startsWith('/api')) {
        const identifier = req.auth?.user?.id || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || "127.0.0.1";

        try {
            const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

            // Add rate limit headers
            const res = NextResponse.next();
            res.headers.set('X-RateLimit-Limit', limit.toString());
            res.headers.set('X-RateLimit-Remaining', remaining.toString());
            res.headers.set('X-RateLimit-Reset', reset.toString());

            if (!success) {
                return new NextResponse("Rate limit exceeded", {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': limit.toString(),
                        'X-RateLimit-Remaining': remaining.toString(),
                        'X-RateLimit-Reset': reset.toString()
                    }
                });
            }
            return res; // Continue if success
        } catch (error) {
            console.error("Rate limit error:", error);
            // Fail open if rate limit fails
        }
    }

    // Default behavior for other routes or if no rate limit
    return NextResponse.next();
});

export const config = {
    // Matcher now includes API routes (removed 'api' from negative lookahead)
    matcher: ['/((?!_next/static|_next/image|.*\\.png$).*)'],
};
