const IMPACT_KEYWORDS_IT = /\b(problema|importante|critico|criticità|impatto|sfida|difficoltà|fondamentale|essenziale|urgente|grave|complesso)\b/i;
const IMPACT_KEYWORDS_EN = /\b(problem|important|critical|impact|challenge|difficulty|fundamental|essential|urgent|serious|complex)\b/i;

const EMOTION_MARKERS_IT = /\b(amo|odio|frustrante|fantastico|terribile|incredibile|assurdo|pazzesco|entusiasta|deluso|soddisfatto|arrabbiato)\b/i;
const EMOTION_MARKERS_EN = /\b(love|hate|frustrating|amazing|terrible|incredible|absurd|crazy|excited|disappointed|satisfied|angry)\b/i;

export type SignalBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SignalResult {
  score: number;       // 0-1
  band: SignalBand;    // LOW (<0.3), MEDIUM (0.3-0.6), HIGH (>0.6)
  snippet: string;     // Best ~20 word snippet for key insight tracking
}

export function computeSignalScore(userMessage: string, language: string): SignalResult {
  const words = userMessage.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const isItalian = language.toLowerCase().startsWith('it');

  // Length component (0-0.4)
  const lengthScore = Math.min(0.4, wordCount / 100);

  // Content richness (0-0.3)
  const hasExamples = /\d|[A-Z][a-z]{2,}/.test(userMessage) ? 0.15 : 0;
  const impactPattern = isItalian ? IMPACT_KEYWORDS_IT : IMPACT_KEYWORDS_EN;
  const hasImpact = impactPattern.test(userMessage) ? 0.15 : 0;
  const richnessScore = hasExamples + hasImpact;

  // Engagement markers (0-0.3)
  const emotionPattern = isItalian ? EMOTION_MARKERS_IT : EMOTION_MARKERS_EN;
  const hasEmotions = emotionPattern.test(userMessage) ? 0.15 : 0;
  const hasDetail = wordCount > 30 ? 0.15 : 0;
  const engagementScore = hasEmotions + hasDetail;

  const score = Math.min(1, lengthScore + richnessScore + engagementScore);
  const band: SignalBand = score < 0.3 ? 'LOW' : score <= 0.6 ? 'MEDIUM' : 'HIGH';

  // Extract best snippet (~20 words from the richest sentence)
  const sentences = userMessage.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const bestSentence = sentences.length > 0
    ? sentences.reduce((best, s) => s.split(/\s+/).length > best.split(/\s+/).length ? s : best)
    : userMessage;
  const snippet = bestSentence.trim().split(/\s+/).slice(0, 20).join(' ');

  return { score, band, snippet };
}

export function computeBudgetAction(
  signalBand: SignalBand,
  turnsUsed: number,
  budget: { minTurns: number; baseTurns: number; maxTurns: number; bonusTurnsGranted: number }
): 'continue' | 'advance' | 'bonus' {
  if (signalBand === 'LOW' && turnsUsed >= budget.minTurns) {
    return 'advance';
  }
  if (signalBand === 'HIGH' && turnsUsed < budget.maxTurns && budget.bonusTurnsGranted < 2) {
    return 'bonus';
  }
  if (turnsUsed >= budget.baseTurns) {
    return 'advance';
  }
  return 'continue';
}

export function stealBonusTurn(
  currentTopicId: string,
  topicBudgets: Record<string, { maxTurns: number; turnsUsed: number; bonusTurnsGranted: number }>
): string | null {
  // Find the unexplored topic with the highest maxTurns to steal from
  let donorId: string | null = null;
  let donorMax = 0;
  for (const [id, budget] of Object.entries(topicBudgets)) {
    if (id === currentTopicId) continue;
    if (budget.turnsUsed > 0) continue; // Already explored, can't steal from it
    if (budget.maxTurns > donorMax) {
      donorMax = budget.maxTurns;
      donorId = id;
    }
  }
  if (donorId && donorMax > 1) {
    // Can steal: donor still has margin above minTurns=1
    return donorId;
  }
  return null; // No donor available
}
