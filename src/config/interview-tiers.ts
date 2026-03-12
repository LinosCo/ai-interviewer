/**
 * 2-Tier Interview Quality Configuration
 *
 * Single source of truth for all tier-specific parameters.
 * standard = lean, conversational interview optimized for comparable quantitative data.
 * avanzato = professional qualitative interview.
 */

export type InterviewTier = 'standard' | 'avanzato';
export type CriticalEscalationMode = 'minimal' | 'focused' | 'selective' | 'aggressive';

export interface TierConfig {
  modelRouting: {
    /**
     * 'minimal'    — cheapest path: critical only for clarification/scope recovery
     * 'focused'    — advanced path: critical only for clarification, scope recovery,
     *                and genuinely high-signal deepening turns
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
  modelRouting: { criticalEscalation: 'minimal' },
  budgets: {
    bonusTurnCap: 0,
    deepenMaxTurnsPerTopic: 1,
    deepExtraTurnCap: 10,
    planBaseTurnsDivisor: 70,
    planBaseTurnsMin: 1,
    planMaxTurnsBonus: 0,
    deepenFallbackTurns: 1,
    probeExampleThreshold: 0.40,
    probeImpactExploreThreshold: 0.58,
    probeImpactDeepenThreshold: 0.44,
  },
  knowledge: { runtimeKnowledgeTimeoutMs: 900, expandedCues: false },
  tone: { useLlm: false },
  naturalness: {
    reflectiveTurns: false,
    crossTopicSynthesis: false,
    devilsAdvocate: false,
    hesitationDetection: false,
    fatigueDetection: false,
    narrativeTransitions: false,
    contextDrivenReordering: false,
  },
  latency: { mainResponseTimeoutMs: 25_000 },
};

const AVANZATO: TierConfig = {
  modelRouting: { criticalEscalation: 'focused' },
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
  knowledge: { runtimeKnowledgeTimeoutMs: 1000, expandedCues: true },
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
  latency: { mainResponseTimeoutMs: 28_000 },
};

export function getTierConfig(quality?: string | null): TierConfig {
  return quality === 'avanzato' ? AVANZATO : STANDARD;
}
