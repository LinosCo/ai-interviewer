export type InterviewPlan = {
  version: number;
  meta: {
    generatedAt: string;
    planLogicVersion: string;
    budgetSignature: string;
    objectiveSignature: string;
    maxDurationMins: number;
    totalTimeSec: number;
    perTopicTimeSec: number;
    secondsPerTurn: number;
    topicsSignature: string;
    interviewerQuality: 'standard' | 'avanzato';
    gradingSource: 'deterministic' | 'llm' | 'llm_fallback';
  };
  coverage: PlanCoverageSummary;
  explore: {
    topics: PlanTopic[];
  };
  deepen: {
    maxTurnsPerTopic: number;
    fallbackTurns: number;
  };
};

export type ImportanceBand = 'critical' | 'high' | 'medium' | 'low';
export type CoverageTier = 'target' | 'stretch' | 'overflow' | 'disabled';

export type PlanCoverageMetrics = {
  coveredTopics: number;
  coveredSubGoals: number;
  totalTopics: number;
  totalSubGoals: number;
  coverageRate: number;
};

export type PlanCoverageExclusion = {
  topicId: string;
  topicLabel: string;
  subGoalId: string;
  subGoalLabel: string;
  importanceBand: ImportanceBand;
  coverageTier: CoverageTier;
};

export type PlanCoverageSummary = {
  targetDurationSec: number;
  stretchDurationSec: number;
  fullCoverageDurationSec: number;
  target: PlanCoverageMetrics;
  stretch: PlanCoverageMetrics;
  full: PlanCoverageMetrics;
  likelyExcludedWithoutDeepOffer: PlanCoverageExclusion[];
};

export type PlanSubGoal = {
  id: string;
  label: string;
  editorialOrderIndex: number;
  importanceScore: number;
  importanceBand: ImportanceBand;
  coverageTier: CoverageTier;
  rationale: string;
  enabled: boolean;
};

export type PlanTopic = {
  topicId: string;
  label: string;
  orderIndex: number;
  editorialOrderIndex: number;
  subGoals: string[];
  subGoalPlans: PlanSubGoal[];
  baseTurns: number;
  minTurns: number;
  maxTurns: number;
  importanceScore: number;
  importanceBand: ImportanceBand;
  rationale: string;
  enabled: boolean;
  targetTurns: number;
  stretchTurns: number;
  fullCoverageTurns: number;
  targetSubGoalCount: number;
  stretchSubGoalCount: number;
  fullCoverageSubGoalCount: number;
  interpretationCues: string[];
  significanceSignals: string[];
  probeAngles: string[];
};

export type InterviewPlanOverrides = {
  explore?: {
    topics?: Record<string, {
      minTurns?: number;
      maxTurns?: number;
      importanceScore?: number;
      importanceBand?: ImportanceBand;
      rationale?: string;
      enabled?: boolean;
      targetTurns?: number;
      stretchTurns?: number;
      targetSubGoalCount?: number;
      stretchSubGoalCount?: number;
      subGoals?: Record<string, {
        importanceScore?: number;
        importanceBand?: ImportanceBand;
        coverageTier?: CoverageTier;
        rationale?: string;
        enabled?: boolean;
      }>;
    }>;
  };
  deepen?: {
    maxTurnsPerTopic?: number;
    fallbackTurns?: number;
  };
};
