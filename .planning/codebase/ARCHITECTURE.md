# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Layered Next.js full-stack application with multi-tenant SaaS architecture

**Key Characteristics:**
- Server-side authentication and authorization with NextAuth
- Database-first design with Prisma ORM
- Multi-tenant organization/project structure
- AI-powered chat and analysis features
- Credit-based usage tracking and billing

## Layers

**Presentation Layer:**
- Purpose: User interface and client-side interactions
- Location: `src/app`, `src/components`
- Contains: Next.js pages, React components, client-side logic
- Depends on: API routes, authentication context
- Used by: End users, web browsers

**API Layer:**
- Purpose: Server-side business logic and external integrations
- Location: `src/app/api`
- Contains: REST API endpoints, webhook handlers, AI service integrations
- Depends on: Services layer, database, external APIs
- Used by: Frontend components, external webhooks

**Services Layer:**
- Purpose: Business logic abstraction and cross-cutting concerns
- Location: `src/services`
- Contains: Credit tracking, chat service, LLM service, plan service
- Depends on: Database, external APIs
- Used by: API routes, middleware

**Database Layer:**
- Purpose: Data persistence and relationships
- Location: `prisma/schema.prisma`, `src/lib/prisma.ts`
- Contains: Prisma schema, database client singleton
- Depends on: PostgreSQL database
- Used by: Services, API routes, actions

**Configuration Layer:**
- Purpose: Application configuration and constants
- Location: `src/config`
- Contains: Plans, limits, credit costs, feature flags
- Depends on: Environment variables
- Used by: Services, middleware, components

## Data Flow

**User Authentication Flow:**

1. User submits credentials via login page
2. NextAuth validates against database users table
3. Session cookie set with user/organization context
4. Middleware validates session on protected routes
5. Dashboard layout loads user-specific data (projects, plans)

**Chat/Interview Flow:**

1. User initiates chat via widget or dashboard
2. Chat service validates bot permissions and usage limits
3. LLM service processes message with bot configuration
4. Token tracking service records usage and deducts credits
5. Response streamed back to client with conversation state

**State Management:**
- Server state via Prisma database queries
- Client state via React hooks and context providers
- Session state via NextAuth cookies

## Key Abstractions

**Multi-tenancy:**
- Purpose: Isolate customer data and enforce access controls
- Examples: `src/app/dashboard/layout.tsx`, `src/contexts/ProjectContext.tsx`
- Pattern: Organization → Projects → Bots hierarchy with role-based access

**Credit System:**
- Purpose: Track and limit AI usage across plans
- Examples: `src/services/tokenTrackingService.ts`, `src/config/creditCosts.ts`
- Pattern: Action-based credit deduction with monthly limits and pack purchases

**Bot Configuration:**
- Purpose: Define AI interviewer behavior and constraints
- Examples: `src/app/api/bots`, `prisma/schema.prisma` Bot model
- Pattern: Template-based configuration with customizable prompts and topic blocks

**Plan-based Features:**
- Purpose: Enable/disable functionality based on subscription tier
- Examples: `src/services/planService.ts`, `src/config/plans.ts`
- Pattern: Feature flags with plan-specific limits and capabilities

## Entry Points

**Marketing Site:**
- Location: `src/app/(marketing)/page.tsx`
- Triggers: Direct navigation to root URL
- Responsibilities: Landing page, pricing, features

**Dashboard Application:**
- Location: `src/app/dashboard/page.tsx`
- Triggers: Authenticated user navigation
- Responsibilities: Project management, bot creation, analytics

**Chat Widget:**
- Location: `src/app/w/[botId]/page.tsx`
- Triggers: Embedded widget or direct chat link
- Responsibilities: Public interview interface

**API Endpoints:**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP requests from frontend or webhooks
- Responsibilities: Business logic, data operations, integrations

## Error Handling

**Strategy:** Layered error handling with graceful degradation

**Patterns:**
- API routes return structured error responses with HTTP status codes
- Middleware catches and transforms errors before reaching routes
- Client-side toast notifications for user-facing errors
- Server-side logging for debugging and monitoring

## Cross-Cutting Concerns

**Logging:** Console logging with structured error objects
**Validation:** Zod schemas for API input validation and type safety
**Authentication:** NextAuth with session-based authentication and role-based authorization

---

*Architecture analysis: 2026-01-26*