import { describe, expect, it } from 'vitest';

import {
  GUIDANCE_STORAGE_KEY,
  completeGuidanceStep,
  createDefaultGuidanceState,
  dismissGuidanceStep,
  mergeAutoCompletedSteps,
  parseGuidanceState,
  readGuidanceState,
  reopenGuidance,
  setGuidanceEnabled,
  writeGuidanceState,
} from '@/lib/guidance/guidance-state';

function createMemoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('guidance-state', () => {
  it('returns defaults when payload is missing or invalid', () => {
    const empty = parseGuidanceState(null);
    const invalid = parseGuidanceState('{not-json');

    expect(empty.enabled).toBe(true);
    expect(empty.dismissedSteps).toEqual([]);
    expect(invalid.completedCheckpoints).toEqual([]);
  });

  it('filters unsupported step ids from persisted payloads', () => {
    const state = parseGuidanceState(JSON.stringify({
      enabled: true,
      dismissedSteps: ['first_interview_creation', 'unknown_step'],
      completedCheckpoints: ['first_integration_connection', 'nope'],
      updatedAt: '2026-03-09T00:00:00.000Z',
    }));

    expect(state.dismissedSteps).toEqual(['first_interview_creation']);
    expect(state.completedCheckpoints).toEqual(['first_integration_connection']);
  });

  it('persists and rehydrates preferences through storage helpers', () => {
    const storage = createMemoryStorage();
    const base = createDefaultGuidanceState();
    const next = completeGuidanceStep(dismissGuidanceStep(base, 'first_visibility_setup'), 'first_visibility_setup');

    writeGuidanceState(next, storage);
    const restored = readGuidanceState(storage);

    expect(restored.dismissedSteps).toContain('first_visibility_setup');
    expect(restored.completedCheckpoints).toContain('first_visibility_setup');
  });

  it('supports disabled state and reopen reset', () => {
    const base = createDefaultGuidanceState();
    const disabled = setGuidanceEnabled(base, false);
    const dismissed = dismissGuidanceStep(disabled, 'project_without_tools');
    const reopened = reopenGuidance(dismissed);

    expect(disabled.enabled).toBe(false);
    expect(reopened.enabled).toBe(true);
    expect(reopened.dismissedSteps).toEqual([]);
  });

  it('merges auto-completed steps without duplicates', () => {
    const base = createDefaultGuidanceState();
    const once = mergeAutoCompletedSteps(base, ['first_tip_review_or_routing']);
    const twice = mergeAutoCompletedSteps(once, ['first_tip_review_or_routing', 'first_integration_connection']);

    expect(once.completedCheckpoints).toEqual(['first_tip_review_or_routing']);
    expect(twice.completedCheckpoints).toEqual(['first_tip_review_or_routing', 'first_integration_connection']);
  });

  it('uses dedicated storage key', () => {
    const storage = createMemoryStorage();
    writeGuidanceState(createDefaultGuidanceState(), storage);
    expect(storage.getItem(GUIDANCE_STORAGE_KEY)).toBeTruthy();
  });
});
