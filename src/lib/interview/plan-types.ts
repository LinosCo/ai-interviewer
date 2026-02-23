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
  explore: {
    topics: PlanTopic[];
  };
  deepen: {
    maxTurnsPerTopic: number;
    fallbackTurns: number;
  };
};

export type PlanTopic = {
  topicId: string;
  label: string;
  orderIndex: number;
  subGoals: string[];
  baseTurns: number;
  minTurns: number;
  maxTurns: number;
  interpretationCues: string[];
  significanceSignals: string[];
  probeAngles: string[];
};

export type InterviewPlanOverrides = {
  explore?: {
    topics?: Record<string, { minTurns?: number; maxTurns?: number }>;
  };
  deepen?: {
    maxTurnsPerTopic?: number;
    fallbackTurns?: number;
  };
};
