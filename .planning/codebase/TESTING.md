# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Vitest 4.0.16
- Config: No project-level vitest config found (uses defaults)

**Assertion Library:**
- Vitest built-in assertions (`expect`)

**Run Commands:**
```bash
# No test scripts defined in package.json
# Tests run manually with: npx vitest
# Watch mode: npx vitest --watch
# Coverage: npx vitest --coverage
```

## Test File Organization

**Location:**
- Co-located pattern: `src/lib/memory/__tests__/memory-manager.test.ts`
- Dedicated test directories: `src/lib/tests/`
- Mixed approach with both patterns

**Naming:**
- `*.test.ts` for unit tests
- Descriptive names: `memory-manager.test.ts`, `interview-e2e.test.ts`

**Structure:**
```
src/
├── lib/
│   ├── memory/
│   │   └── __tests__/
│   │       └── memory-manager.test.ts
│   └── tests/
│       ├── interview-e2e.test.ts
│       └── conversation-flow.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('ComponentName', () => {
    describe('methodName', () => {
        it('should behave as expected', () => {
            // Test implementation
        });
    });
});
```

**Patterns:**
- Nested `describe` blocks for grouping by method/functionality
- Descriptive test names with "should" statements
- Setup/teardown not extensively used (simple unit tests)

## Mocking

**Framework:** Built-in Vitest mocking capabilities

**Patterns:**
```typescript
// Simulation-based testing rather than mocking
const simulateStateTransition = (state, userMessage, config) => {
    // State machine simulation
};

// Test data factories
const TEST_BOT = {
    id: 'test-bot-e2e',
    name: 'Test Interviewer',
    // ... configuration
};

const USER_RESPONSES = {
    cooperative: [
        'Sample response 1',
        'Sample response 2'
    ]
};
```

**What to Mock:**
- External API calls (implied but not shown)
- Database operations (simulated with test data)

**What NOT to Mock:**
- Pure functions and business logic
- State transitions (simulated instead)

## Fixtures and Factories

**Test Data:**
```typescript
const memory: ConversationMemoryData = {
    factsCollected: [{
        id: '1',
        content: 'L\'utente è a Verona per vacanza',
        topic: 'motivazioni',
        extractedAt: new Date().toISOString(),
        confidence: 0.9,
        keywords: ['Verona', 'vacanza']
    }],
    topicsExplored: [],
    unansweredAreas: [],
    userFatigueScore: 0.2,
    detectedTone: 'casual' as const,
    avgResponseLength: 50,
    usesEmoji: false
};
```

**Location:**
- Inline test data within test files
- Shared test configurations for E2E tests

## Coverage

**Requirements:** No coverage targets enforced

**View Coverage:**
```bash
npx vitest --coverage
```

## Test Types

**Unit Tests:**
- Component-level testing (`MemoryManager.formatForPrompt`)
- Utility function testing
- Isolated business logic validation

**Integration Tests:**
- End-to-end conversation flow testing
- State machine transition validation
- Multi-component interaction testing

**E2E Tests:**
- Comprehensive interview simulation (`interview-e2e.test.ts`)
- Full conversation lifecycle testing
- User scenario validation

## Common Patterns

**Async Testing:**
```typescript
describe('asyncFunction', () => {
    it('should handle async operations', async () => {
        const result = await asyncFunction();
        expect(result).toBeDefined();
    });
});
```

**Error Testing:**
```typescript
it('should throw error for invalid input', () => {
    expect(() => {
        functionThatThrows();
    }).toThrow('Expected error message');
});
```

**State Testing:**
```typescript
it('should transition state correctly', () => {
    const initialState = { phase: 'SCAN', topicIndex: 0 };
    const newState = simulateStateTransition(initialState, 'user input', config);

    expect(newState.phase).toBe('DEEP');
    expect(newState.topicIndex).toBe(1);
});
```

## Test Architecture

**Simulation Approach:**
- Complex E2E tests use state machine simulation
- Deterministic test scenarios with predefined user responses
- Comprehensive validation of business rules

**Test Reports:**
```typescript
interface TestReport {
    testName: string;
    passed: boolean;
    issues: string[];
    metrics: Record<string, any>;
    transcript: Message[];
}
```

**Execution Pattern:**
- Self-contained test suites with main runner functions
- Detailed console output for debugging
- Metric collection for performance validation

---

*Testing analysis: 2026-01-26*