import { Card } from "@/components/ui/card";
import { LLMInsightCard } from "./LLMInsightCard";
import { Bot, Target, Zap } from "lucide-react";

interface PlatformResult {
  name: string;
  query: string;
  response: string;
  mentioned: boolean;
  partial: boolean;
  confidence: number;
  analysis: string;
}

interface LLMInsightsSectionProps {
  platformResults: PlatformResult[];
  brandName?: string;
}

// Helper function to extract competitors from response
const extractCompetitors = (response: string, brandName?: string): string[] => {
  const competitors: string[] = [];
  
  // Common patterns for competitor mentions
  const patterns = [
    /(?:competitors|alternatives|similar to|like|such as|including)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s+(?:and|or|,)|\.|$)/gi,
    /([A-Z][a-zA-Z0-9\s&]+?)\s+(?:is|are)\s+(?:a|an|the)\s+(?:popular|leading|top|best)/gi,
  ];

  patterns.forEach(pattern => {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const name = match[1].trim();
        // Filter out generic terms and the brand itself
        if (
          name.length > 2 && 
          name.length < 50 &&
          !['The', 'This', 'That', 'These', 'Those', 'Some', 'Many', 'Most'].includes(name) &&
          name !== brandName
        ) {
          competitors.push(name);
        }
      }
    }
  });

  // Remove duplicates and limit to top 5
  return [...new Set(competitors)].slice(0, 5);
};

// Helper function to generate insights from response
const generateInsights = (
  response: string, 
  mentioned: boolean, 
  partial: boolean,
  brandName?: string
): {
  brandMentionScore: number;
  risks: string[];
  opportunities: string[];
  summary: string[];
} => {
  const summary: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  
  let brandMentionScore = 0;
  
  if (mentioned) {
    brandMentionScore = 9;
    summary.push("Il brand è stato menzionato esplicitamente nella risposta");
    
    if (response.toLowerCase().includes('raccomand') || response.toLowerCase().includes('consiglio')) {
      brandMentionScore = 10;
      summary.push("L'AI raccomanda attivamente il tuo brand");
    }
    
    opportunities.push("Mantieni e rafforza questa visibilità con contenuti di qualità");
  } else if (partial) {
    brandMentionScore = 5;
    summary.push("Il brand è stato menzionato solo parzialmente o in modo vago");
    risks.push("La menzione non è abbastanza chiara o prominente");
    opportunities.push("Migliora i contenuti per ottenere menzioni più esplicite");
  } else {
    brandMentionScore = 0;
    summary.push("Il brand non è stato menzionato nella risposta");
    risks.push("L'AI non riconosce il tuo brand come rilevante per questa query");
    opportunities.push("Implementa structured data e ottimizza i contenuti per questa categoria");
  }

  const competitors = extractCompetitors(response, brandName);
  if (competitors.length > 0) {
    risks.push(`${competitors.length} competitor menzionati al posto tuo`);
  }

  return {
    brandMentionScore,
    risks,
    opportunities,
    summary
  };
};

export const LLMInsightsSection = ({ platformResults, brandName }: LLMInsightsSectionProps) => {
  const enrichedResults = platformResults.map(result => ({
    ...result,
    competitors: extractCompetitors(result.response, brandName),
    insights: generateInsights(result.response, result.mentioned, result.partial, brandName)
  }));

  // Calculate comparative metrics
  const avgBrandMentionScore = enrichedResults.reduce((sum, r) => sum + r.insights.brandMentionScore, 0) / enrichedResults.length;
  const totalCompetitors = enrichedResults.reduce((sum, r) => sum + r.competitors.length, 0);
  const mentionedCount = enrichedResults.filter(r => r.mentioned).length;

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Bot className="w-8 h-8 text-creative" />
        Test sui principali AI
      </h2>

      {/* Comparative Overview */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-creative/10 to-creative/5 border-creative/20">
        <h3 className="text-lg font-semibold mb-4">Panoramica comparativa</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-5 h-5 text-creative" />
              <span className="text-sm text-muted-foreground">Media Brand Mention</span>
            </div>
            <div className="text-3xl font-bold text-creative">{avgBrandMentionScore.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10 su tutti gli AI</div>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-warning" />
              <span className="text-sm text-muted-foreground">Competitor Totali</span>
            </div>
            <div className="text-3xl font-bold text-warning">{totalCompetitors}</div>
            <div className="text-xs text-muted-foreground">brand citati al posto tuo</div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-success" />
              <span className="text-sm text-muted-foreground">Piattaforme Positive</span>
            </div>
            <div className="text-3xl font-bold text-success">{mentionedCount}/{enrichedResults.length}</div>
            <div className="text-xs text-muted-foreground">AI che ti menzionano</div>
          </div>
        </div>
      </Card>

      {/* Individual Platform Cards */}
      <div className="space-y-6">
        {enrichedResults.map((result, index) => (
          <LLMInsightCard
            key={index}
            platform={result.name}
            query={result.query}
            response={result.response}
            mentioned={result.mentioned}
            partial={result.partial}
            confidence={result.confidence}
            analysis={result.analysis}
            competitors={result.competitors}
            insights={result.insights}
          />
        ))}
      </div>
    </div>
  );
};
