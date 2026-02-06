import { isConsentPendingForDataCollection } from './flow-guards';

export function shouldOfferContinuationAfterDeep(params: {
    remainingSec: number;
    deepAccepted: boolean | null | undefined;
}): boolean {
    return params.remainingSec > 0 && params.deepAccepted !== true;
}

export function shouldInterceptTopicPhaseClosure(params: {
    phase: string;
    isGoodbyeResponse: boolean;
    isGoodbyeWithQuestion: boolean;
    hasNoQuestion: boolean;
    isPrematureContactRequest: boolean;
    hasCompletionTag: boolean;
}): boolean {
    const inTopicPhase = params.phase === 'SCAN' || params.phase === 'DEEP';
    if (!inTopicPhase) return false;

    return (
        params.isGoodbyeResponse ||
        params.isGoodbyeWithQuestion ||
        params.hasNoQuestion ||
        params.isPrematureContactRequest ||
        params.hasCompletionTag
    );
}

export function shouldInterceptDeepOfferClosure(params: {
    phase: string;
    isGoodbyeResponse: boolean;
    isGoodbyeWithQuestion: boolean;
    hasNoQuestion: boolean;
    hasCompletionTag: boolean;
}): boolean {
    if (params.phase !== 'DEEP_OFFER') return false;
    return (
        params.isGoodbyeResponse ||
        params.isGoodbyeWithQuestion ||
        params.hasNoQuestion ||
        params.hasCompletionTag
    );
}

export type CompletionGuardAction = 'ask_consent' | 'ask_missing_field' | 'allow_completion';

export function getCompletionGuardAction(params: {
    shouldCollectData: boolean;
    candidateFieldIds: string[];
    consentGiven: boolean | null;
    dataCollectionRefused?: boolean;
    missingField: string | null;
}): CompletionGuardAction {
    const consentPending = isConsentPendingForDataCollection({
        shouldCollectData: params.shouldCollectData,
        candidateFieldIds: params.candidateFieldIds,
        consentGiven: params.consentGiven,
        dataCollectionRefused: params.dataCollectionRefused
    });

    if (consentPending) return 'ask_consent';
    if (params.shouldCollectData && params.missingField && !params.dataCollectionRefused) return 'ask_missing_field';
    return 'allow_completion';
}
