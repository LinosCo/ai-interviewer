export type InterviewPlan = {
  version: number;
  meta: {
    generatedAt: string;
    planLogicVersion: string;
    maxDurationMins: number;
    totalTimeSec: number;
    perTopicTimeSec: number;
    secondsPerTurn: number;
    topicsSignature: string;
  };
  scan: {
    topics: PlanTopic[];
  };
  deep: {
    strategy: 'uncovered_subgoals_first';
    maxTurnsPerTopic: number;
    fallbackTurns: number;
    topics: PlanTopic[];
  };
};

export type PlanTopic = {
  topicId: string;
  label: string;
  orderIndex: number;
  subGoals: string[];
  minTurns: number;
  maxTurns: number;
};

export type InterviewPlanOverrides = {
  scan?: {
    topics?: Record<string, { minTurns?: number; maxTurns?: number }>;
  };
  deep?: {
    maxTurnsPerTopic?: number;
    fallbackTurns?: number;
    topics?: Record<string, { maxTurns?: number }>;
  };
};
