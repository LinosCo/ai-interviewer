/**
 * 2-Tier Interview Quality Configuration
 *
 * Single source of truth for all tier-specific parameters.
 * standard = current baseline behavior (zero changes).
 * avanzato = professional qualitative interview.
 */

export type InterviewTier = 'standard' | 'avanzato';
export type CriticalEscalationMode = 'selective' | 'aggressive';

export interface TierConfig {
  modelRouting: {
    /**
     * 'selective'  — current logic: critical used ~25-30% of turns
     *                (first turn on topic, clarification, off-topic, high-signal deepening, transition)
     * 'aggressive' — critical for ALL explore/deepen/transition turns (~70-80%)
     *                primary only for: DATA_COLLECTION, greeting, closing
     */
    criticalEscalation: CriticalEscalationMode;
  };
  budgets: {
    bonusTurnCap: number;
    deepenMaxTurnsPerTopic: number;
    deepExtraTurnCap: number;
    planBaseTurnsDivisor: number;
    planBaseTurnsMin: number;
    planMaxTurnsBonus: number;
    deepenFallbackTurns: number;
    probeExampleThreshold: number;
    probeImpactExploreThreshold: number;
    probeImpactDeepenThreshold: number;
  };
  knowledge: {
    runtimeKnowledgeTimeoutMs: number;
    expandedCues: boolean;
  };
  tone: {
    /** true = LLM-based tone analysis (current). false = heuristic (saves ~500ms). */
    useLlm: boolean;
  };
  naturalness: {
    reflectiveTurns: boolean;
    crossTopicSynthesis: boolean;
    devilsAdvocate: boolean;
    hesitationDetection: boolean;
    fatigueDetection: boolean;
    narrativeTransitions: boolean;
    contextDrivenReordering: boolean;
  };
  latency: {
    mainResponseTimeoutMs: number;
  };
}

const STANDARD: TierConfig = {
  modelRouting: { criticalEscalation: 'selective' },
  budgets: {
    bonusTurnCap: 1,
    deepenMaxTurnsPerTopic: 1,
    deepExtraTurnCap: 10,
    planBaseTurnsDivisor: 55,
    planBaseTurnsMin: 2,
    planMaxTurnsBonus: 1,
    deepenFallbackTurns: 1,
    probeExampleThreshold: 0.28,
    probeImpactExploreThreshold: 0.42,
    probeImpactDeepenThreshold: 0.34,
  },
  knowledge: { runtimeKnowledgeTimeoutMs: 1400, expandedCues: false },
  tone: { useLlm: true },
  naturalness: {
    reflectiveTurns: false,
    crossTopicSynthesis: false,
    devilsAdvocate: false,
    hesitationDetection: false,
    fatigueDetection: false,
    narrativeTransitions: false,
    contextDrivenReordering: false,
  },
  latency: { mainResponseTimeoutMs: 45_000 },
};

const AVANZATO: TierConfig = {
  modelRouting: { criticalEscalation: 'selective' },
  budgets: {
    bonusTurnCap: 2,
    deepenMaxTurnsPerTopic: 2,
    deepExtraTurnCap: 10,
    planBaseTurnsDivisor: 42,
    planBaseTurnsMin: 2,
    planMaxTurnsBonus: 2,
    deepenFallbackTurns: 2,
    probeExampleThreshold: 0.18,
    probeImpactExploreThreshold: 0.30,
    probeImpactDeepenThreshold: 0.24,
  },
  knowledge: { runtimeKnowledgeTimeoutMs: 1200, expandedCues: true },
  tone: { useLlm: false },
  naturalness: {
    reflectiveTurns: true,
    crossTopicSynthesis: true,
    devilsAdvocate: true,
    hesitationDetection: true,
    fatigueDetection: true,
    narrativeTransitions: true,
    contextDrivenReordering: true,
  },
  latency: { mainResponseTimeoutMs: 30_000 },
};

export function getTierConfig(quality?: string | null): TierConfig {
  return quality === 'avanzato' ? AVANZATO : STANDARD;
}
