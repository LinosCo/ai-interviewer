# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
ai-interviewer/
├── src/                # Main application code
│   ├── app/           # Next.js 13+ app router pages and API routes
│   ├── components/    # Reusable React components
│   ├── services/      # Business logic and external integrations
│   ├── lib/          # Utilities and shared libraries
│   ├── config/       # Application configuration
│   ├── middleware/   # Request middleware
│   ├── actions/      # Server actions
│   ├── contexts/     # React context providers
│   ├── hooks/        # Custom React hooks
│   └── types/        # TypeScript type definitions
├── prisma/           # Database schema and migrations
├── public/           # Static assets
├── scripts/          # Utility scripts
├── knowledge/        # Documentation and knowledge base
├── docs/            # Project documentation
└── .planning/       # GSD planning documents
```

## Directory Purposes

**src/app:**
- Purpose: Next.js app router pages, layouts, and API routes
- Contains: Page components, route handlers, middleware
- Key files: `layout.tsx`, `page.tsx`, `route.ts`

**src/components:**
- Purpose: Reusable UI components organized by feature
- Contains: Landing page sections, dashboard components, UI primitives
- Key files: `landing/`, `dashboard/`, `chat/`, `ui/`

**src/services:**
- Purpose: Business logic abstraction and external service integrations
- Contains: Credit tracking, chat processing, AI services, plan management
- Key files: `tokenTrackingService.ts`, `chat-service.ts`, `llmService.ts`

**src/lib:**
- Purpose: Utility functions and shared libraries
- Contains: Database client, utilities, design system
- Key files: `prisma.ts`, `utils.ts`, `design-system.ts`

**src/config:**
- Purpose: Application configuration and constants
- Contains: Plans, limits, feature flags, API configurations
- Key files: `plans.ts`, `limits.ts`, `creditCosts.ts`

**src/middleware:**
- Purpose: Request processing middleware
- Contains: Authentication, rate limiting, feature guards
- Key files: `conversationLimits.ts`, `featureGuard.ts`, `simulationLimiter.ts`

**prisma:**
- Purpose: Database schema and migration management
- Contains: Schema definition, migrations, seed data
- Key files: `schema.prisma`, `migrations/`, `seed.ts`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root application layout
- `src/app/(marketing)/page.tsx`: Landing page
- `src/app/dashboard/page.tsx`: Main dashboard
- `src/app/w/[botId]/page.tsx`: Chat widget interface

**Configuration:**
- `package.json`: Dependencies and scripts
- `tailwind.config.ts`: Styling configuration
- `src/auth.config.ts`: Authentication configuration
- `src/middleware.ts`: Global middleware

**Core Logic:**
- `src/lib/prisma.ts`: Database client singleton
- `src/auth.ts`: Authentication provider setup
- `src/services/tokenTrackingService.ts`: Credit management
- `src/services/chat-service.ts`: Chat processing logic

**Testing:**
- No test files detected in current structure

## Naming Conventions

**Files:**
- React components: PascalCase (`DashboardSidebar.tsx`)
- Pages: `page.tsx` (App Router convention)
- API routes: `route.ts` (App Router convention)
- Services: camelCase with `.ts` extension (`tokenTrackingService.ts`)
- Configuration: camelCase or kebab-case (`auth.config.ts`)

**Directories:**
- Feature-based: lowercase or kebab-case (`dashboard`, `landing`)
- Route groups: parentheses for layout organization (`(marketing)`)
- Dynamic routes: square brackets (`[botId]`, `[conversationId]`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/components/[feature]/` for UI, `src/services/` for logic
- Tests: Co-located with components (not currently implemented)

**New API Route:**
- Implementation: `src/app/api/[endpoint]/route.ts`
- Business logic: Extract to `src/services/` if complex

**New Page:**
- Implementation: `src/app/[route]/page.tsx`
- Layout: `src/app/[route]/layout.tsx` if needed

**New Component:**
- Reusable UI: `src/components/ui/`
- Feature-specific: `src/components/[feature]/`
- Landing page sections: `src/components/landing/`

**Utilities:**
- Shared helpers: `src/lib/utils.ts`
- Configuration: `src/config/[category].ts`

## Special Directories

**src/app/(marketing):**
- Purpose: Route group for marketing pages with shared layout
- Generated: No
- Committed: Yes

**src/app/api:**
- Purpose: API route handlers for backend functionality
- Generated: No
- Committed: Yes

**node_modules:**
- Purpose: Installed npm dependencies
- Generated: Yes
- Committed: No

**.next:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**prisma/migrations:**
- Purpose: Database schema change history
- Generated: By Prisma migrate
- Committed: Yes

**.planning:**
- Purpose: GSD planning and analysis documents
- Generated: By GSD tools
- Committed: Yes

---

*Structure analysis: 2026-01-26*