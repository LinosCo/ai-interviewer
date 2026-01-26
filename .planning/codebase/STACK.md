# Technology Stack

**Analysis Date:** 2026-01-26

## Languages

**Primary:**
- TypeScript 5.x - All application code, components, and server logic
- JavaScript - Build scripts and configurations

**Secondary:**
- SQL - Database schemas and migrations via Prisma

## Runtime

**Environment:**
- Node.js (inferred from Next.js dependency)
- React 19.2.1

**Package Manager:**
- npm - No lockfile present, using package.json
- Lockfile: missing

## Frameworks

**Core:**
- Next.js 16.0.8 - Full-stack React framework with App Router
- React 19.2.1 - UI components and rendering
- React DOM 19.2.1 - DOM rendering

**Testing:**
- Vitest 4.0.16 - Test runner and framework

**Build/Dev:**
- Tailwind CSS 4.x - Styling framework
- PostCSS 4.x - CSS processing
- ESLint 9.x - Code linting
- TypeScript 5.x - Type checking and compilation

## Key Dependencies

**Critical:**
- Prisma 5.22.0 - Database ORM and client
- NextAuth.js 5.0.0-beta.30 - Authentication framework
- Zod 4.2.1 - Schema validation

**Infrastructure:**
- @upstash/ratelimit 1.0.0 - Rate limiting service
- @upstash/redis 1.28.0 - Redis client for rate limiting

**AI/LLM:**
- ai 5.0.115 - Vercel AI SDK core
- @ai-sdk/anthropic 2.0.56 - Anthropic Claude integration
- @ai-sdk/google 3.0.10 - Google AI integration
- @ai-sdk/openai 2.0.88 - OpenAI integration
- @ai-sdk/react 2.0.117 - React hooks for AI

**Payments:**
- stripe 20.1.0 - Payment processing

**Communication:**
- resend 6.6.0 - Email service

**Analytics:**
- @google-analytics/data 5.2.1 - Google Analytics API
- @vercel/speed-insights 1.3.1 - Performance monitoring

**UI Components:**
- @radix-ui/react-* - Headless UI components (dialog, progress, tabs, tooltip)
- lucide-react 0.560.0 - Icon library
- framer-motion 12.23.26 - Animation library
- recharts 3.5.1 - Chart components

**Utilities:**
- axios 1.13.2 - HTTP client
- cheerio 1.1.2 - Server-side HTML parsing
- date-fns 4.1.0 - Date manipulation
- jsonwebtoken 9.0.3 - JWT handling
- bcryptjs 3.0.3 - Password hashing
- uuid 13.0.0 - UUID generation
- class-variance-authority 0.7.1 - Conditional styling
- clsx 2.1.1 - Conditional class names
- tailwind-merge 3.4.0 - Tailwind class merging

## Configuration

**Environment:**
- Environment variables via `.env` and `.env.local`
- Database connections, API keys, and auth secrets stored in env vars
- TypeScript path aliases: `@/*` maps to `./src/*`

**Build:**
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript compiler options
- `eslint.config.mjs` - ESLint configuration
- `postcss.config.mjs` - PostCSS configuration
- `tailwind.config.ts` - Tailwind configuration

## Platform Requirements

**Development:**
- Node.js runtime
- PostgreSQL database (Neon hosted)
- TypeScript support

**Production:**
- Vercel deployment platform
- PostgreSQL database (Neon)
- Environment variables for API keys and secrets

---

*Stack analysis: 2026-01-26*