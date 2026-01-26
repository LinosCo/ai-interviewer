# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- React Components: PascalCase (`Button.tsx`, `ProjectAnalytics.tsx`)
- Pages: kebab-case or lowercase (`page.tsx`, `privacy/page.tsx`)
- Utilities/Services: camelCase (`tokenTrackingService.ts`, `memory-manager.ts`)
- Middleware: camelCase (`rateLimiter.ts`, `featureGuard.ts`)
- Actions: kebab-case (`bot-actions.ts`)

**Functions:**
- Actions: camelCase with "Action" suffix (`createBotAction`, `deleteBotAction`)
- React Components: PascalCase (`Button`, `ProjectAnalytics`)
- Utilities: camelCase (`getEffectiveApiKey`, `isFeatureEnabled`)
- Server Actions: "use server" directive at top

**Variables:**
- camelCase for regular variables (`conversationId`, `apiKey`)
- SCREAMING_SNAKE_CASE for constants (`MAX_CONTENT_LENGTH`, `HIDDEN_LIMITS`)

**Types:**
- PascalCase for interfaces and types (`ButtonProps`, `InterviewState`)
- Database models follow Prisma conventions (PascalCase)

## Code Style

**Formatting:**
- No explicit formatter config found (relies on Next.js defaults)
- Consistent 4-space indentation observed
- Semicolons required

**Linting:**
- ESLint with Next.js configuration
- Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Global ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. React/Next.js core imports (`'react'`, `'next/navigation'`)
2. Third-party packages (`'@ai-sdk/openai'`, `'@prisma/client'`)
3. Internal absolute imports (`'@/auth'`, `'@/lib/prisma'`)
4. Relative imports (rare, mostly absolute paths used)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Error Handling

**Patterns:**
- Server Actions: `throw new Error("Message")` for user-facing errors
- API Routes: Try-catch with appropriate HTTP status codes
- Async functions: Standard async/await with error propagation
- Authentication: Check session and throw "Unauthorized" errors

## Logging

**Framework:** console (standard Node.js logging)

**Patterns:**
- `console.error()` for error conditions
- `console.warn()` for warnings and fallbacks
- `console.log()` for debug/development info
- Structured logging in some services with context

## Comments

**When to Comment:**
- Complex business logic (server actions)
- Security checks and authorization
- TODO/FIXME items sparingly used

**JSDoc/TSDoc:**
- Comprehensive JSDoc in test files (`@fileoverview` style)
- Interface documentation in TypeScript files
- Parameter descriptions for complex functions

## Function Design

**Size:** Functions tend to be medium-large (50-200 lines for complex server actions)

**Parameters:**
- Server Actions: `(id: string, formData: FormData)` pattern
- React Components: Props destructuring with defaults
- Utility functions: Typed parameters with interfaces

**Return Values:**
- Server Actions: void or `{ success: boolean }`
- React Components: JSX.Element
- Utilities: Typed return values with proper inference

## Module Design

**Exports:**
- Named exports preferred (`export async function`)
- Default exports for React components when single export
- Barrel exports not extensively used

**Barrel Files:**
- Limited use of index files for re-exports
- Direct imports from specific files preferred

## React Patterns

**Components:**
- Functional components with hooks
- `React.forwardRef` for ref-forwarding components
- Props interfaces defined inline or separately

**State Management:**
- Context API for project state (`ProjectContext`)
- Local state with `useState` for component state
- Server state managed through Server Actions

## Authentication & Authorization

**Pattern:**
- `const session = await auth()` at start of server actions
- Role-based checks (`user.role === 'ADMIN'`)
- Resource ownership verification before mutations

## Database Patterns

**Prisma Usage:**
- Transaction usage for complex operations (`prisma.$transaction`)
- Include statements for related data
- Proper error handling for not found cases

---

*Convention analysis: 2026-01-26*