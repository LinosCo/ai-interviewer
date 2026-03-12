import { describe, expect, it } from 'vitest';
import { alignStateWithCompletionGuard, type CompletionGuardState } from '../completion-guard-alignment';

function makeState(overrides: Partial<CompletionGuardState> = {}): CompletionGuardState {
  return {
    phase: 'DEEPEN',
    consentGiven: null,
    forceConsentQuestion: false,
    dataCollectionRefused: false,
    lastAskedField: null,
    ...overrides,
  };
}

describe('alignStateWithCompletionGuard', () => {
  it('moves to DATA_COLLECTION consent when completion is blocked for consent', () => {
    const state = makeState();

    const insight = alignStateWithCompletionGuard({
      action: 'ask_consent',
      nextState: state,
    });

    expect(state.phase).toBe('DATA_COLLECTION');
    expect(state.consentGiven).toBe(false);
    expect(state.forceConsentQuestion).toBe(true);
    expect(state.lastAskedField).toBeNull();
    expect(insight).toEqual({ status: 'DATA_COLLECTION_CONSENT' });
  });

  it('moves to DATA_COLLECTION field collection when a field is still missing', () => {
    const state = makeState({ consentGiven: true });

    const insight = alignStateWithCompletionGuard({
      action: 'ask_missing_field',
      nextState: state,
      missingField: 'role',
    });

    expect(state.phase).toBe('DATA_COLLECTION');
    expect(state.consentGiven).toBe(true);
    expect(state.forceConsentQuestion).toBe(false);
    expect(state.lastAskedField).toBe('role');
    expect(insight).toEqual({ status: 'DATA_COLLECTION', nextSubGoal: 'role' });
  });
});
