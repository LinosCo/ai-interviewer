import type {
  DeltaType,
  NarrativeState,
  ResponseValueBand,
  TopicalUserTurnInterpretation,
} from './chat-intent';

export type TurnNextAction = 'follow_up' | 'continue' | 'transition' | 'offer_extension' | 'collect_data';

export interface TopicTurnDecision {
  responseValue: ResponseValueBand;
  deltaType: DeltaType;
  narrativeState: NarrativeState;
  nextAction: TurnNextAction;
  highValue: boolean;
  rationale: string;
}

function fallbackResponseValue(signalScore: number): ResponseValueBand {
  if (signalScore >= 0.72) return 'very_high';
  if (signalScore >= 0.48) return 'high';
  if (signalScore >= 0.22) return 'medium';
  return 'low';
}

function normalizeInterpretation(
  interpretation: TopicalUserTurnInterpretation | null | undefined,
  signalScore: number
): Pick<TopicTurnDecision, 'responseValue' | 'deltaType' | 'narrativeState'> {
  return {
    responseValue: interpretation?.responseValue || fallbackResponseValue(signalScore),
    deltaType: interpretation?.deltaType || 'none',
    narrativeState: interpretation?.narrativeState || 'answered_thread',
  };
}

export function buildTopicTurnDecision(params: {
  phase: 'EXPLORE' | 'DEEPEN';
  interviewerQuality: 'standard' | 'avanzato';
  interpretation?: TopicalUserTurnInterpretation | null;
  signalScore: number;
  remainingTargetSubGoals: number;
  remainingStretchSubGoals: number;
  turnInTopic: number;
  maxTurnsInTopic: number;
}): TopicTurnDecision {
  const normalized = normalizeInterpretation(params.interpretation, params.signalScore);
  const hasRelevantDelta =
    normalized.deltaType === 'new_direction' ||
    normalized.deltaType === 'contradiction' ||
    normalized.deltaType === 'concrete_example';
  const highValue = normalized.responseValue === 'high' || normalized.responseValue === 'very_high';
  const veryHighValue = normalized.responseValue === 'very_high';
  const targetCoveragePending = params.remainingTargetSubGoals > 0;
  const stretchCoverageAvailable = params.remainingStretchSubGoals > 0;

  let nextAction: TurnNextAction = 'continue';
  let rationale = 'planned_progression';

  if (params.phase === 'EXPLORE') {
    if (targetCoveragePending) {
      if (params.interviewerQuality === 'avanzato' && highValue && hasRelevantDelta) {
        nextAction = 'follow_up';
        rationale = 'high_value_delta_with_target_pending';
      } else {
        nextAction = 'continue';
        rationale = 'target_coverage_pending';
      }
    } else if (!stretchCoverageAvailable) {
      nextAction = 'transition';
      rationale = 'coverage_complete';
    } else if (params.interviewerQuality === 'standard') {
      if (highValue && params.turnInTopic === 0 && params.maxTurnsInTopic > 1) {
        nextAction = 'continue';
        rationale = 'standard_single_useful_followup';
      } else {
        nextAction = 'transition';
        rationale = 'standard_prefers_transition';
      }
    } else if (hasRelevantDelta && highValue) {
      nextAction = 'follow_up';
      rationale = 'advanced_high_value_delta';
    } else if (normalized.responseValue === 'medium' && normalized.narrativeState !== 'transition_ready') {
      nextAction = 'continue';
      rationale = 'advanced_continue_on_medium_value';
    } else {
      nextAction = 'transition';
      rationale = 'low_incremental_value';
    }
  } else {
    if (targetCoveragePending) {
      nextAction = hasRelevantDelta && highValue ? 'follow_up' : 'continue';
      rationale = hasRelevantDelta && highValue
        ? 'deepen_target_pending_high_value'
        : 'deepen_target_pending';
    } else if (!stretchCoverageAvailable) {
      nextAction = normalized.narrativeState === 'open_thread' && highValue && params.interviewerQuality === 'avanzato'
        ? 'follow_up'
        : 'transition';
      rationale = nextAction === 'follow_up'
        ? 'advanced_open_thread_after_coverage'
        : 'deepen_coverage_complete';
    } else if (normalized.narrativeState === 'transition_ready' && normalized.responseValue === 'low') {
      nextAction = 'transition';
      rationale = 'deepen_transition_ready';
    } else if (params.interviewerQuality === 'avanzato' && (hasRelevantDelta || veryHighValue)) {
      nextAction = 'follow_up';
      rationale = 'advanced_deepen_followup';
    } else if (normalized.responseValue === 'medium' || highValue) {
      nextAction = 'continue';
      rationale = 'deepen_continue_on_value';
    } else {
      nextAction = 'transition';
      rationale = 'deepen_low_value';
    }
  }

  return {
    ...normalized,
    nextAction,
    highValue,
    rationale,
  };
}
