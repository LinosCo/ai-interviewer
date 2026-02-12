export type TransitionMode = 'bridge' | 'clean_pivot';

export type SupervisorStatus =
  | 'SCANNING'
  | 'TRANSITION'
  | 'START_DEEP'
  | 'START_DEEP_BRIEF'
  | 'DEEPENING'
  | 'DEEP_OFFER_ASK'
  | 'DATA_COLLECTION_CONSENT'
  | 'DATA_COLLECTION'
  | 'COMPLETE_WITHOUT_DATA'
  | 'FINAL_GOODBYE'
  | 'CONFIRM_STOP';

export interface SupervisorInsight {
  status: SupervisorStatus;
  nextSubGoal?: string;
  focusPoint?: string;
  nextTopic?: string;
  transitionUserMessage?: string;
  transitionMode?: TransitionMode;
  transitionBridgeSnippet?: string;
  engagingSnippet?: string;
  extensionPreview?: string[];
  stopReason?: string;
}

export function createDefaultSupervisorInsight(): SupervisorInsight {
  return { status: 'SCANNING' };
}

export function createDeepOfferInsight(extensionPreview?: string[]): SupervisorInsight {
  const cleanPreview = (extensionPreview || [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .slice(0, 2);

  return cleanPreview.length > 0
    ? { status: 'DEEP_OFFER_ASK', extensionPreview: cleanPreview }
    : { status: 'DEEP_OFFER_ASK' };
}

export type Phase = 'SCAN' | 'DEEP_OFFER' | 'DEEP' | 'DATA_COLLECTION';

export interface InterviewStateLike {
  phase: Phase;
  topicIndex: number;
  turnInTopic: number;
  deepAccepted: boolean | null;
  consentGiven: boolean | null;
  dataCollectionAttempts: number;
  extensionReturnPhase?: 'SCAN' | 'DEEP' | null;
  extensionReturnTopicIndex?: number | null;
  extensionReturnTurnInTopic?: number | null;
  extensionOfferAttempts?: number;
  deepTopicOrder?: string[];
  deepTurnsByTopic?: Record<string, number>;
  topicSubGoalHistory?: Record<string, string[]>;
  interestingTopics?: Array<{ topicId: string; bestSnippet?: string }>;
  forceConsentQuestion?: boolean;
}

export interface DeepOfferPhaseDeps {
  checkUserIntent: (userMessage: string, context: 'deep_offer') => Promise<'ACCEPT' | 'REFUSE' | 'NEUTRAL'>;
  isExtensionOfferQuestion: (message: string) => boolean;
  buildDeepOfferInsight: (sourceState: InterviewStateLike) => SupervisorInsight;
  buildDeepPlan: (remainingSec: number) => { deepTopicOrder: string[]; deepTurnsByTopic: Record<string, number> };
  getDeepTopics: (deepOrder?: string[]) => any[];
  getRemainingSubGoals: (topic: any, history?: Record<string, string[]>) => string[];
  selectDeepFocusPoint: (params: {
    topic: any;
    availableSubGoals: string[];
    engagingSnippet: string;
    lastUserMessage: string;
  }) => string;
}

export interface DeepOfferPhaseParams {
  state: InterviewStateLike;
  nextState: InterviewStateLike;
  botTopics: any[];
  canonicalMessages: Array<{ role: string; content: string }>;
  lastUserMessage: string;
  shouldCollectData: boolean;
  maxDurationMins: number;
  effectiveSec: number;
  deps: DeepOfferPhaseDeps;
}

export interface DeepOfferPhaseResult {
  nextState: InterviewStateLike;
  supervisorInsight: SupervisorInsight;
  nextTopicId?: string;
}

export async function runDeepOfferPhase(params: DeepOfferPhaseParams): Promise<DeepOfferPhaseResult> {
  const { state, nextState, botTopics, canonicalMessages, lastUserMessage, shouldCollectData, maxDurationMins, effectiveSec, deps } = params;
  let supervisorInsight: SupervisorInsight = deps.buildDeepOfferInsight(state);
  let nextTopicId: string | undefined;

  const hasUserReply = String(lastUserMessage || '').trim().length > 0;
  const waitingForAnswer = state.deepAccepted === false || state.deepAccepted === null;
  const lastAssistantMessage = [...canonicalMessages].reverse().find((m) => m.role === 'assistant')?.content || '';
  const previousWasOffer = deps.isExtensionOfferQuestion(lastAssistantMessage);

  const moveToDataCollection = () => {
    nextState.extensionOfferAttempts = 0;
    nextState.extensionReturnPhase = null;
    nextState.extensionReturnTopicIndex = null;
    nextState.extensionReturnTurnInTopic = null;
    nextState.phase = 'DATA_COLLECTION';
    if (shouldCollectData) {
      supervisorInsight = { status: 'DATA_COLLECTION_CONSENT' };
      nextState.consentGiven = false;
      nextState.forceConsentQuestion = true;
    } else {
      supervisorInsight = { status: 'COMPLETE_WITHOUT_DATA' };
    }
  };

  if (!hasUserReply || !waitingForAnswer || !previousWasOffer) {
    if (hasUserReply && waitingForAnswer && !previousWasOffer) {
      const fallbackIntent = await deps.checkUserIntent(lastUserMessage, 'deep_offer');
      if (fallbackIntent === 'REFUSE') {
        moveToDataCollection();
      } else {
        const extensionAttempts = (state.extensionOfferAttempts ?? 0) + 1;
        if (extensionAttempts >= 2) {
          moveToDataCollection();
        } else {
          supervisorInsight = deps.buildDeepOfferInsight(state);
          nextState.deepAccepted = false;
          nextState.extensionOfferAttempts = extensionAttempts;
        }
      }
    } else {
      supervisorInsight = deps.buildDeepOfferInsight(state);
      nextState.deepAccepted = false;
      nextState.extensionOfferAttempts = state.extensionOfferAttempts ?? 0;
    }
    return { nextState, supervisorInsight, nextTopicId };
  }

  const intent = await deps.checkUserIntent(lastUserMessage, 'deep_offer');
  if (intent === 'ACCEPT') {
    const returnPhase = state.extensionReturnPhase || 'DEEP';
    nextState.deepAccepted = true;
    nextState.extensionOfferAttempts = 0;
    nextState.extensionReturnPhase = null;
    nextState.extensionReturnTopicIndex = null;
    nextState.extensionReturnTurnInTopic = null;

    if (returnPhase === 'SCAN') {
      nextState.phase = 'SCAN';
      nextState.topicIndex = Math.max(0, state.extensionReturnTopicIndex ?? state.topicIndex ?? 0);
      nextState.turnInTopic = Math.max(0, state.extensionReturnTurnInTopic ?? state.turnInTopic ?? 0);
      const resumeTopic = botTopics[nextState.topicIndex] || botTopics[0];
      nextTopicId = resumeTopic?.id || botTopics[0]?.id;
      const usedSubGoals = (state.topicSubGoalHistory || {})[resumeTopic.id] || [];
      const availableSubGoals = (resumeTopic.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
      supervisorInsight = { status: 'SCANNING', nextSubGoal: availableSubGoals[0] || resumeTopic.label };
      return { nextState, supervisorInsight, nextTopicId };
    }

    nextState.phase = 'DEEP';
    nextState.topicIndex = Math.max(0, state.extensionReturnTopicIndex ?? state.topicIndex ?? 0);
    nextState.turnInTopic = Math.max(0, state.extensionReturnTurnInTopic ?? state.turnInTopic ?? 0);

    const maxDurationSec = maxDurationMins * 60;
    const remainingSecForDeep = maxDurationSec - effectiveSec;
    const hasDeepPlan = Boolean(state.deepTurnsByTopic && Object.keys(state.deepTurnsByTopic).length > 0);
    if (!hasDeepPlan) {
      const deepPlan = deps.buildDeepPlan(remainingSecForDeep);
      nextState.deepTopicOrder = deepPlan.deepTopicOrder;
      nextState.deepTurnsByTopic = deepPlan.deepTurnsByTopic;
    }

    const deepOrder = (nextState.deepTopicOrder && nextState.deepTopicOrder.length > 0)
      ? nextState.deepTopicOrder
      : (state.deepTopicOrder || []);
    const deepTopics = deps.getDeepTopics(deepOrder);
    const deepCurrent = deepTopics[nextState.topicIndex] || botTopics[nextState.topicIndex] || botTopics[0];
    nextTopicId = deepCurrent?.id || botTopics[0]?.id;
    const usedSubGoals = (state.topicSubGoalHistory || {})[deepCurrent.id] || [];
    const availableSubGoals = (deepCurrent.subGoals || []).filter((sg: string) => !usedSubGoals.includes(sg));
    const engagingSnippet = (state.interestingTopics || []).find((it) => it.topicId === deepCurrent.id)?.bestSnippet || '';
    const focusPoint = deps.selectDeepFocusPoint({
      topic: deepCurrent,
      availableSubGoals,
      engagingSnippet,
      lastUserMessage
    });
    supervisorInsight = { status: 'DEEPENING', focusPoint: focusPoint || deepCurrent.label, engagingSnippet };
    return { nextState, supervisorInsight, nextTopicId };
  }

  if (intent === 'REFUSE') {
    moveToDataCollection();
    return { nextState, supervisorInsight, nextTopicId };
  }

  const extensionAttempts = state.extensionOfferAttempts ?? 0;
  if (extensionAttempts >= 2) {
    moveToDataCollection();
  } else {
    supervisorInsight = deps.buildDeepOfferInsight(state);
    nextState.deepAccepted = false;
    nextState.extensionOfferAttempts = extensionAttempts + 1;
  }

  return { nextState, supervisorInsight, nextTopicId };
}
