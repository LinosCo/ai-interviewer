# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**AI/LLM Providers:**
- OpenAI - GPT models and completions
  - SDK/Client: @ai-sdk/openai
  - Auth: Custom API keys (encrypted in database or env vars)
- Anthropic Claude - Claude models and completions
  - SDK/Client: @ai-sdk/anthropic
  - Auth: Custom API keys (encrypted in database or env vars)
- Google AI - Gemini and other Google AI models
  - SDK/Client: @ai-sdk/google
  - Auth: Custom API keys (encrypted in database or env vars)

**Analytics:**
- Google Analytics - Data tracking and insights
  - SDK/Client: @google-analytics/data
  - Auth: Service account credentials
- Vercel Speed Insights - Performance monitoring
  - SDK/Client: @vercel/speed-insights
  - Auth: Automatic with Vercel deployment

**Rate Limiting:**
- Upstash Redis - Rate limiting storage
  - SDK/Client: @upstash/redis, @upstash/ratelimit
  - Auth: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

**Web Scraping:**
- Cheerio - Server-side HTML parsing for web data extraction
  - Implementation: `src/lib/visibility/` components
- Axios - HTTP client for web requests
  - Used for: API calls and web scraping

## Data Storage

**Databases:**
- PostgreSQL (Neon hosted)
  - Connection: DATABASE_URL, POSTGRES_*
  - Client: @prisma/client
  - Schema: `prisma/schema.prisma`

**File Storage:**
- Local filesystem only (no cloud storage detected)

**Caching:**
- Redis (Upstash) - Rate limiting and session storage
  - Connection: UPSTASH_* env vars

## Authentication & Identity

**Auth Provider:**
- NextAuth.js v5 (beta) - Custom authentication system
  - Implementation: `src/auth.ts`, `src/auth.config.ts`
  - Adapter: @auth/prisma-adapter for database persistence
  - Session: JWT-based with AUTH_SECRET
  - Providers: Credentials, email verification

## Monitoring & Observability

**Error Tracking:**
- Console logging only (no external error service detected)

**Logs:**
- Console-based logging throughout application

**Performance:**
- Vercel Speed Insights for frontend performance

## CI/CD & Deployment

**Hosting:**
- Vercel platform
  - Config: VERCEL_OIDC_TOKEN in env vars
  - Auto-deployment from git

**CI Pipeline:**
- Vercel automatic builds and deployments

## Environment Configuration

**Required env vars:**
- AUTH_SECRET - NextAuth.js secret for JWT signing
- DATABASE_URL - PostgreSQL connection string
- STRIPE_SECRET_KEY - Stripe payment processing
- RESEND_API_KEY - Email service
- ENCRYPTION_KEY - For encrypting stored API keys
- NEXTAUTH_URL - Base URL for auth callbacks

**Secrets location:**
- Environment variables (`.env`, `.env.local`)
- Database (GlobalConfig table for Stripe keys)
- Encrypted API keys in User model

## Webhooks & Callbacks

**Incoming:**
- Stripe webhooks at `/api/stripe/webhook/route.ts`
- Addon webhooks at `/api/addons/webhook/route.ts`

**Outgoing:**
- Email notifications via Resend
- CMS sync analytics via cron job `/api/cron/cms-sync-analytics/route.ts`

## Payment Processing

**Provider:**
- Stripe - Subscription and one-time payments
  - SDK/Client: stripe package
  - Webhooks: Payment confirmations and subscription updates
  - Configuration: Dynamic from env vars or database

## Email Services

**Provider:**
- Resend - Transactional emails
  - SDK/Client: resend package
  - Auth: RESEND_API_KEY
  - Templates: Password reset, credit notifications, system alerts
  - From: Business Tuner <hello@voler.ai>

## CMS & Content

**Search Console:**
- Google Search Console API
  - Implementation: `src/lib/cms/search-console.service.ts`
  - Auth: Service account credentials

---

*Integration audit: 2026-01-26*