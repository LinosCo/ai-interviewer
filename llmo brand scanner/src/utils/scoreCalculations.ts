interface TechnicalCheck {
  name: string;
  description: string;
  status: "pass" | "warning" | "fail";
  score: number;
}

interface PlatformResult {
  name: string;
  mentioned: boolean;
  partial: boolean;
  confidence: number;
}

interface ScoreContribution {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

// Calculate score contributions breakdown
export const calculateScoreContributions = (
  technicalChecks: TechnicalCheck[],
  platformResults: PlatformResult[],
  productAnalysis?: any
): ScoreContribution[] => {
  // Technical checks contribution (max 30 points)
  const technicalScore = technicalChecks.reduce((sum, check) => {
    if (check.status === "pass") return sum + check.score;
    if (check.status === "warning") return sum + check.score * 0.5;
    return sum;
  }, 0);
  const maxTechnicalScore = technicalChecks.reduce((sum, check) => sum + check.score, 0);
  const normalizedTechnicalScore = Math.round((technicalScore / maxTechnicalScore) * 30);

  // Platform mentions contribution (max 40 points)
  const mentionScore = platformResults.reduce((sum, result) => {
    if (result.mentioned) return sum + 10;
    if (result.partial) return sum + 5;
    return sum;
  }, 0);
  const maxMentionScore = platformResults.length * 10;
  const normalizedMentionScore = Math.round((mentionScore / maxMentionScore) * 40);

  // Information extraction contribution (max 20 points)
  let extractionScore = 0;
  if (productAnalysis) {
    if (productAnalysis.mainFunction) extractionScore += 5;
    if (productAnalysis.needs?.primary?.length > 0) extractionScore += 5;
    if (productAnalysis.needs?.secondary?.length > 0) extractionScore += 3;
    if (productAnalysis.contexts?.length > 0) extractionScore += 4;
    if (productAnalysis.clusters?.length > 0) extractionScore += 3;
  }

  // Structured data / AI Readiness (max 10 points)
  const structuredDataChecks = technicalChecks.filter(check => 
    check.name.toLowerCase().includes('schema') ||
    check.name.toLowerCase().includes('json-ld') ||
    check.name.toLowerCase().includes('organization')
  );
  const structuredDataScore = Math.round(
    (structuredDataChecks.filter(c => c.status === 'pass').length / Math.max(structuredDataChecks.length, 1)) * 10
  );

  return [
    {
      label: "Estrazione informazioni",
      value: extractionScore,
      maxValue: 20,
      color: "bg-gradient-to-r from-blue-500 to-blue-400"
    },
    {
      label: "Risposte LLM",
      value: normalizedMentionScore,
      maxValue: 40,
      color: "bg-gradient-to-r from-creative to-creative/80"
    },
    {
      label: "Verifiche tecniche",
      value: normalizedTechnicalScore,
      maxValue: 30,
      color: "bg-gradient-to-r from-success to-success/80"
    },
    {
      label: "Structured Data / AI Readiness",
      value: structuredDataScore,
      maxValue: 10,
      color: "bg-gradient-to-r from-purple-500 to-purple-400"
    }
  ];
};

// Calculate improvement suggestions
export const calculateImprovementSuggestion = (
  technicalChecks: TechnicalCheck[],
  platformResults: PlatformResult[]
): { actions: number; potentialGain: number } | undefined => {
  const failedChecks = technicalChecks.filter(c => c.status === 'fail');
  const warningChecks = technicalChecks.filter(c => c.status === 'warning');
  const notMentioned = platformResults.filter(p => !p.mentioned && !p.partial);

  // Calculate potential gain from top priority fixes
  let potentialGain = 0;
  let actions = 0;

  // High impact: Fix failed checks (especially schema/structured data)
  const criticalFailures = failedChecks.filter(c => 
    c.name.toLowerCase().includes('schema') ||
    c.name.toLowerCase().includes('json-ld') ||
    c.score >= 10
  );
  
  if (criticalFailures.length > 0) {
    potentialGain += criticalFailures.reduce((sum, c) => sum + c.score, 0);
    actions += Math.min(criticalFailures.length, 2);
  }

  // Medium impact: Fix warnings
  if (warningChecks.length > 0 && actions < 3) {
    const topWarnings = warningChecks.slice(0, 3 - actions);
    potentialGain += topWarnings.reduce((sum, c) => sum + (c.score * 0.5), 0);
    actions += topWarnings.length;
  }

  // If we have potential improvement
  if (actions > 0) {
    return {
      actions,
      potentialGain: Math.round(potentialGain)
    };
  }

  return undefined;
};

// Calculate benchmark percentile (simulated - in production this would come from actual data)
export const calculateBenchmark = (score: number): number => {
  // Simplified percentile calculation
  // In production, this would query actual distribution data
  if (score >= 85) return 92;
  if (score >= 75) return 78;
  if (score >= 65) return 61;
  if (score >= 55) return 45;
  if (score >= 45) return 32;
  if (score >= 35) return 21;
  return 12;
};
