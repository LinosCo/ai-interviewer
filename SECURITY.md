# Security Guide

## Overview

This document outlines the security measures implemented in AI Interviewer and provides guidance for secure deployment and operation.

## Recent Security Fixes (2026-01-13)

### Critical Vulnerabilities Fixed

1. **XSS Vulnerability (DOM-based)** - FIXED
   - Location: `src/components/interview-chat.tsx`
   - Issue: Unsafe use of `.innerHTML` with dynamic brandColor
   - Fix: Replaced with safe DOM manipulation using `createElement()` and `textContent`

2. **Weak Random Generation** - FIXED
   - Location: `src/app/actions.ts:97`
   - Issue: Bot slugs generated with `Math.random() * 1000` (high collision risk)
   - Fix: Replaced with `crypto.randomUUID()` for cryptographically secure randomness

3. **API Key Exposure** - FIXED
   - Location: Multiple files
   - Issue: API keys stored in plaintext in database
   - Fix: Implemented AES-256-GCM encryption for all API keys
   - **Action Required**: Set `ENCRYPTION_KEY` in environment variables (see Setup section)

4. **IDOR Vulnerabilities** - FIXED
   - Location: `/api/bots/[botId]/reward/route.ts`, `/api/bots/[botId]/legal/route.ts`
   - Issue: Missing authentication and authorization checks
   - Fix: Added session verification and project ownership validation

5. **Weak Authorization** - FIXED
   - Location: `src/app/actions.ts` (deleteBotAction, addKnowledgeSourceAction)
   - Issue: Insufficient ownership verification
   - Fix: Added explicit project ownership and access checks

6. **Prompt Injection Risk** - MITIGATED
   - Location: `src/app/actions.ts` (addKnowledgeSourceAction)
   - Issue: Knowledge base content stored without sanitization
   - Fix: Added input validation, length limits, and control character removal

## Security Setup

### Required Environment Variables

```bash
# Generate a new encryption key (run once)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
ENCRYPTION_KEY=your_64_character_hex_key_here

# Add to Vercel/Production Environment Variables
vercel env add ENCRYPTION_KEY
```

### Migrating Existing API Keys

If you have existing unencrypted API keys in your database, they will still work (backward compatible). New keys will be encrypted automatically. To encrypt existing keys:

```typescript
// Run this migration script once
import { prisma } from '@/lib/prisma';
import { encryptIfNeeded } from '@/lib/encryption';

async function migrateKeys() {
  // Migrate global config
  const globalConfig = await prisma.globalConfig.findUnique({ where: { id: 'default' } });
  if (globalConfig) {
    await prisma.globalConfig.update({
      where: { id: 'default' },
      data: {
        openaiApiKey: encryptIfNeeded(globalConfig.openaiApiKey),
        anthropicApiKey: encryptIfNeeded(globalConfig.anthropicApiKey)
      }
    });
  }

  // Migrate bot-specific keys
  const bots = await prisma.bot.findMany({
    where: {
      OR: [
        { openaiApiKey: { not: null } },
        { anthropicApiKey: { not: null } }
      ]
    }
  });

  for (const bot of bots) {
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        openaiApiKey: encryptIfNeeded(bot.openaiApiKey),
        anthropicApiKey: encryptIfNeeded(bot.anthropicApiKey)
      }
    });
  }
}
```

## Security Best Practices

### Authentication & Authorization

1. **Session Management**
   - NextAuth v5 handles session cookies securely
   - AUTH_SECRET must be set to a strong random value
   - Sessions expire after inactivity

2. **Role-Based Access Control (RBAC)**
   - USER: Basic access to own organizations
   - MEMBER: Can view and edit projects they're invited to
   - VIEWER: Read-only access to projects
   - ADMIN: Full system access (use sparingly)

3. **Project-Level Access**
   - Every bot belongs to a project
   - Every project has an owner
   - Additional users can be granted access via `ProjectAccess`
   - Always verify ownership before delete operations
   - Verify ownership OR access for edit operations

### Input Validation

1. **Server Actions**
   - All server actions must call `auth()` first
   - Validate all inputs with Zod schemas where possible
   - Sanitize user-generated content before storing

2. **API Routes**
   - Verify authentication on every request
   - Validate request body with Zod
   - Check resource ownership before operations
   - Return appropriate HTTP status codes (401 vs 403)

3. **Knowledge Base Content**
   - Maximum 50KB per knowledge source
   - Control characters removed (except newlines/tabs)
   - Be aware of potential prompt injection in LLM context

### Database Security

1. **Prisma Best Practices**
   - Use parameterized queries (Prisma does this by default)
   - Never concatenate user input into raw queries
   - Use `include` carefully to avoid N+1 queries

2. **Sensitive Data**
   - API keys: Always encrypted
   - Passwords: Hashed by NextAuth (bcrypt)
   - PII: Marked in schema, handle with care
   - Interview transcripts: Contain user data, ensure proper access control

### API Key Management

1. **Encryption**
   - All API keys encrypted with AES-256-GCM
   - Unique salt and IV per key
   - Master key stored in environment variable
   - **Never commit encryption key to Git**

2. **Key Hierarchy**
   - Bot-specific keys override user keys
   - User keys override global keys
   - Admin can set global fallback keys
   - Regular users cannot access global keys

3. **Key Rotation**
   - If ENCRYPTION_KEY is compromised, generate new key
   - Decrypt all existing keys with old key
   - Re-encrypt with new key
   - Update ENCRYPTION_KEY in all environments

### Rate Limiting

**TODO**: Implement rate limiting middleware

Critical endpoints that need rate limiting:
- `/api/auth/signin` - 5 requests/minute per IP
- `/api/auth/signup` - 3 requests/hour per IP
- `/api/chat` - 60 requests/minute per user
- `/api/bots/generate` - 10 requests/hour per user

Recommended: Use `@upstash/ratelimit` with Redis

### CORS & CSRF

1. **CORS**
   - API routes should verify Origin header for public endpoints
   - Interview routes (`/i/[slug]`) are intentionally public

2. **CSRF**
   - NextAuth provides CSRF protection for auth routes
   - Server actions are protected by same-origin policy
   - Consider explicit CSRF tokens for sensitive operations

### Logging & Monitoring

1. **Security Events to Log**
   - Failed authentication attempts
   - Unauthorized access attempts
   - API key usage (without exposing keys)
   - Subscription changes
   - User role changes

2. **PII in Logs**
   - Never log full API keys
   - Mask email addresses (use first 3 chars + ***)
   - Don't log interview content
   - Sanitize error messages sent to client

3. **Recommended Tools**
   - Sentry for error tracking
   - Vercel Analytics for performance
   - Custom analytics for security events

### Production Checklist

Before deploying to production:

- [ ] Set strong `AUTH_SECRET` (32+ random bytes)
- [ ] Set `ENCRYPTION_KEY` (64 hex characters)
- [ ] Enable HTTPS only (no HTTP)
- [ ] Set secure cookie flags in NextAuth config
- [ ] Verify DATABASE_URL uses SSL (`sslmode=require`)
- [ ] Rotate all API keys that were ever exposed
- [ ] Enable rate limiting middleware
- [ ] Set up error monitoring (Sentry)
- [ ] Configure CSP headers
- [ ] Enable Vercel security headers
- [ ] Review all environment variables
- [ ] Audit user roles and permissions
- [ ] Test password reset flow
- [ ] Verify GDPR data export works
- [ ] Set up backup strategy for database
- [ ] Document incident response plan

### Security Headers

Add to `next.config.js`:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
}
```

## Vulnerability Disclosure

If you discover a security vulnerability, please email security@voler.ai with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Do not** open public GitHub issues for security vulnerabilities.

## Security Updates

This file will be updated as new security measures are implemented. Check the git history for the timeline of changes.

Last Updated: 2026-01-13
