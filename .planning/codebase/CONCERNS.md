# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Type Safety Issues:**
- Issue: Widespread use of `any` type defeating TypeScript benefits
- Files: `src/middleware/apiKeyRestriction.ts`, `src/lib/analytics/AnalyticsEngine.ts`, `src/app/actions.ts`
- Impact: Runtime errors, difficult debugging, reduced code maintainability
- Fix approach: Replace `any` with proper types, add strict TypeScript config

**Large File Complexity:**
- Issue: Critical files exceeding 1000+ lines becoming monolithic
- Files: `src/app/api/chat/route.ts` (1277 lines), `src/lib/llm/prompt-builder.ts` (1057 lines), `src/app/actions.ts` (958 lines)
- Impact: Difficult maintenance, testing, and code review
- Fix approach: Split into smaller modules, extract business logic into services

**Schema TODO Comments:**
- Issue: Incomplete database schema implementation
- Files: `src/app/actions.ts:96` - "TODO: Add to schema? Yes, schema has it."
- Impact: Data inconsistency, potential runtime failures
- Fix approach: Complete schema migration and remove TODO markers

## Known Bugs

**Console Logging in Production:**
- Symptoms: Debug logs and console statements throughout codebase
- Files: Multiple files including `src/auth.ts:14`, `src/services/creditNotificationService.ts:65`, `src/app/actions.ts:243`
- Trigger: Any error or notification flow
- Workaround: Filter logs in production environment

**Hardcoded API Key Handling:**
- Symptoms: Manual null assignments with type casting
- Files: `src/app/actions.ts:374-375` - `data.openaiApiKey = null as any`
- Trigger: Form submissions with empty API keys
- Workaround: Proper validation before assignment

## Security Considerations

**API Key Exposure:**
- Risk: API keys handled in multiple locations without consistent sanitization
- Files: `src/middleware/apiKeyRestriction.ts`, multiple API routes
- Current mitigation: Basic sanitization in some middleware
- Recommendations: Centralized key management, audit all key handling paths

**User Data Sanitization:**
- Risk: Inconsistent user data filtering across endpoints
- Files: `src/middleware/apiKeyRestriction.ts:50` - `sanitizeUserData` function
- Current mitigation: Role-based filtering in middleware
- Recommendations: Implement comprehensive data access controls

**In-Memory Secret Storage:**
- Risk: Secrets stored in memory without proper cleanup
- Files: `src/middleware/rateLimiter.ts:11`, `src/services/creditNotificationService.ts:18`
- Current mitigation: Limited session-based storage
- Recommendations: Use secure storage solutions for sensitive data

## Performance Bottlenecks

**Database Query Patterns:**
- Problem: Multiple sequential database queries in actions
- Files: `src/app/actions.ts` - Multiple `prisma.bot.findMany` calls
- Cause: N+1 query pattern in conversation analysis
- Improvement path: Batch queries, use database joins, implement query optimization

**Memory Cache Implementation:**
- Problem: Simple in-memory caching without size limits
- Files: `src/lib/llm/candidate-extractor.ts:8`, `src/middleware/rateLimiter.ts`
- Cause: Unbounded cache growth
- Improvement path: Implement LRU cache with size limits

**Large File Processing:**
- Problem: Synchronous processing of large conversation datasets
- Files: `src/lib/analytics/AnalyticsEngine.ts` - Processing all conversations at once
- Cause: Single-threaded analysis without pagination
- Improvement path: Implement streaming, pagination, background processing

## Fragile Areas

**Interview State Management:**
- Files: `src/app/api/chat/route.ts`
- Why fragile: Complex state machine with multiple phases and transitions
- Safe modification: Use state validation, comprehensive testing
- Test coverage: Needs integration tests for phase transitions

**Credit System:**
- Files: `src/services/creditService.ts`, `src/services/tokenTrackingService.ts`
- Why fragile: Multiple services handling credit calculations
- Safe modification: Validate calculations in isolated environments
- Test coverage: Missing edge case tests for credit exhaustion

**Analytics Engine:**
- Files: `src/lib/analytics/AnalyticsEngine.ts`
- Why fragile: Heavy type casting and complex data transformations
- Safe modification: Add strict typing, validate data at boundaries
- Test coverage: Limited coverage for complex aggregation logic

## Scaling Limits

**Database Connection Pool:**
- Current capacity: Default Prisma connection limits
- Limit: High concurrent user load
- Scaling path: Implement connection pooling, read replicas

**Memory Usage:**
- Current capacity: In-memory caches for rate limiting and notifications
- Limit: High user count with active sessions
- Scaling path: External cache (Redis), distributed session management

## Dependencies at Risk

**Deprecated Token Tracking:**
- Risk: Legacy subscription counter system marked as deprecated
- Impact: Billing calculation inconsistencies
- Migration plan: Complete migration to new credit system in `src/services/tokenTrackingService.ts:264`

**Multiple LLM Provider Dependencies:**
- Risk: Tight coupling to specific AI SDK versions
- Impact: Breaking changes in AI providers affect entire system
- Migration plan: Implement provider abstraction layer

## Missing Critical Features

**Comprehensive Error Handling:**
- Problem: Inconsistent error handling patterns across services
- Blocks: Proper debugging and user experience
- Priority: High

**Rate Limiting for All Endpoints:**
- Problem: Only some endpoints have rate limiting
- Blocks: Protection against abuse
- Priority: Medium

## Test Coverage Gaps

**Integration Test Coverage:**
- What's not tested: End-to-end interview flows with database persistence
- Files: `src/app/api/chat/route.ts`, conversation state management
- Risk: State corruption undetected in production
- Priority: High

**Error Handling Paths:**
- What's not tested: Exception scenarios and recovery mechanisms
- Files: All service layer files
- Risk: Unhandled exceptions causing system failures
- Priority: High

**Credit System Edge Cases:**
- What's not tested: Concurrent credit operations, exhaustion scenarios
- Files: `src/services/creditService.ts`
- Risk: Credit leaks or incorrect billing
- Priority: High

---

*Concerns audit: 2026-01-26*