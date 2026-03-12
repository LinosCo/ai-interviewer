import type { SupervisorInsight } from './interview-supervisor';

type CompletionGuardAction = 'allow_completion' | 'ask_consent' | 'ask_missing_field';

export type CompletionGuardState = {
  phase: 'EXPLORE' | 'DEEP_OFFER' | 'DEEPEN' | 'DATA_COLLECTION';
  consentGiven: boolean | null;
  forceConsentQuestion?: boolean;
  dataCollectionRefused?: boolean;
  lastAskedField: string | null;
};

export function alignStateWithCompletionGuard(params: {
  action: CompletionGuardAction;
  nextState: CompletionGuardState;
  missingField?: string | null;
}): SupervisorInsight {
  const { action, nextState, missingField } = params;

  if (action === 'ask_consent') {
    nextState.phase = 'DATA_COLLECTION';
    nextState.consentGiven = false;
    nextState.forceConsentQuestion = true;
    nextState.dataCollectionRefused = false;
    nextState.lastAskedField = null;
    return { status: 'DATA_COLLECTION_CONSENT' };
  }

  if (action === 'ask_missing_field' && missingField) {
    nextState.phase = 'DATA_COLLECTION';
    nextState.consentGiven = true;
    nextState.forceConsentQuestion = false;
    nextState.dataCollectionRefused = false;
    nextState.lastAskedField = missingField;
    return { status: 'DATA_COLLECTION', nextSubGoal: missingField };
  }

  return { status: 'FINAL_GOODBYE' };
}
