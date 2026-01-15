import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LLMInsightCardProps {
  platform: string;
  query: string;
  response: string;
  mentioned: boolean;
  partial: boolean;
  confidence: number;
  analysis: string;
  competitors?: string[];
  insights?: {
    brandMentionScore: number;
    risks: string[];
    opportunities: string[];
    summary: string[];
  };
}

export const LLMInsightCard = ({
  platform,
  query,
  response,
  mentioned,
  partial,
  confidence,
  analysis,
  competitors = [],
  insights
}: LLMInsightCardProps) => {
  const [showFullResponse, setShowFullResponse] = useState(false);

  const getMentionBadge = () => {
    if (mentioned) {
      return <Badge className="bg-success text-success-foreground">Menzionato</Badge>;
    }
    if (partial) {
      return <Badge className="bg-warning text-warning-foreground">Menzionato parzialmente</Badge>;
    }
    return <Badge className="bg-error text-error-foreground">Non menzionato</Badge>;
  };

  const getMentionScore = () => {
    if (mentioned) return 10;
    if (partial) return 5;
    return 0;
  };

  const brandMentionScore = insights?.brandMentionScore ?? getMentionScore();
  const competitorRisk = competitors.length > 2 ? "Alto" : competitors.length > 0 ? "Medio" : "Basso";
  
  const getRiskColor = (risk: string) => {
    if (risk === "Alto") return "text-error";
    if (risk === "Medio") return "text-warning";
    return "text-success";
  };

  const getRiskIcon = (risk: string) => {
    if (risk === "Alto" || risk === "Medio") return TrendingDown;
    return TrendingUp;
  };

  const RiskIcon = getRiskIcon(competitorRisk);

  return (
    <Card className="p-6 border-l-4 border-l-creative/50 hover:border-l-creative transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">{platform}</h3>
            {getMentionBadge()}
          </div>
          <p className="text-sm text-muted-foreground italic">"{query}"</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Brand Mention Score</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Punteggio da 0 a 10 che misura quanto chiaramente il tuo brand è stato menzionato e raccomandato
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-creative">{brandMentionScore}</span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
        </div>

        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Rischio Competitor</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    I competitor menzionati rappresentano un rischio: l'AI li raccomanda al posto tuo
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <RiskIcon className={`w-5 h-5 ${getRiskColor(competitorRisk)}`} />
            <span className={`text-lg font-semibold ${getRiskColor(competitorRisk)}`}>
              {competitorRisk}
            </span>
          </div>
        </div>
      </div>

      {/* Competitors */}
      {competitors.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h4 className="text-sm font-semibold">Competitor citati</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {competitors.map((competitor, index) => (
              <Badge key={index} variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
                {competitor}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Insights Summary */}
      {insights && (
        <div className="space-y-4 mb-6">
          {insights.summary && insights.summary.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-creative" />
                Sintesi
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {insights.summary.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-creative mt-1">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.risks && insights.risks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-error">
                <AlertTriangle className="w-4 h-4" />
                Rischi
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {insights.risks.map((risk, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-error mt-1">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.opportunities && insights.opportunities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-success">
                <TrendingUp className="w-4 h-4" />
                Opportunità
              </h4>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {insights.opportunities.map((opp, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-success mt-1">•</span>
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Toggle Full Response */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFullResponse(!showFullResponse)}
        className="w-full text-creative hover:text-creative/80 hover:bg-creative/10"
      >
        {showFullResponse ? (
          <>
            <ChevronUp className="w-4 h-4 mr-2" />
            Nascondi risposta completa
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 mr-2" />
            Mostra risposta completa
          </>
        )}
      </Button>

      {/* Full Response */}
      {showFullResponse && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {response}
          </p>
        </div>
      )}
    </Card>
  );
};
