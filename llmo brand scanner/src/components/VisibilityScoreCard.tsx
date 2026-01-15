import { TrendingUp, Info, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreContribution {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

interface VisibilityScoreCardProps {
  score: number;
  contributions: ScoreContribution[];
  benchmark?: number;
  improvementSuggestion?: {
    actions: number;
    potentialGain: number;
  };
}

export const VisibilityScoreCard = ({ 
  score, 
  contributions, 
  benchmark = 32,
  improvementSuggestion 
}: VisibilityScoreCardProps) => {
  
  const getScoreLevel = (score: number) => {
    if (score >= 85) return { 
      label: "Eccellente", 
      color: "bg-success text-success-foreground", 
      gradient: "from-success/20 to-success/5",
      description: "Il tuo brand è altamente visibile negli assistenti AI" 
    };
    if (score >= 70) return { 
      label: "Buono", 
      color: "bg-success/80 text-success-foreground", 
      gradient: "from-success/15 to-success/5",
      description: "Ottima visibilità, ma c'è margine di miglioramento" 
    };
    if (score >= 50) return { 
      label: "Discreto", 
      color: "bg-warning text-warning-foreground", 
      gradient: "from-warning/15 to-warning/5",
      description: "Visibilità media, sono necessari interventi strategici" 
    };
    if (score >= 30) return { 
      label: "Basso", 
      color: "bg-error/80 text-error-foreground", 
      gradient: "from-error/15 to-error/5",
      description: "Bassa visibilità, interventi urgenti richiesti" 
    };
    return { 
      label: "Critico", 
      color: "bg-error text-error-foreground", 
      gradient: "from-error/20 to-error/5",
      description: "Il tuo brand è quasi invisibile agli assistenti AI" 
    };
  };

  const level = getScoreLevel(score);
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={`p-8 mb-8 border-l-4 border-l-creative bg-gradient-to-br ${level.gradient}`}>
      <div className="grid md:grid-cols-[auto,1fr] gap-8 items-start">
        {/* Score Circle */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-48 h-48">
              <circle
                cx="96"
                cy="96"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-muted/20"
              />
              <circle
                cx="96"
                cy="96"
                r="70"
                stroke="hsl(var(--creative))"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out drop-shadow-lg"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Sparkles className="w-6 h-6 text-creative mb-1 animate-pulse-glow" />
              <span className="text-5xl font-bold bg-gradient-to-br from-creative to-creative/60 bg-clip-text text-transparent">
                {score}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <Badge className={`mt-4 ${level.color} px-4 py-1 text-sm font-semibold`}>
            {level.label}
          </Badge>
          <p className="text-xs text-center text-muted-foreground mt-2 max-w-[200px]">
            {level.description}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Contributions Bar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Composizione del punteggio</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Il punteggio è calcolato in base a: qualità delle informazioni estratte, 
                      menzioni nelle risposte AI, verifiche tecniche e structured data
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="space-y-3">
              {contributions.map((contrib, index) => {
                const percentage = (contrib.value / contrib.maxValue) * 100;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{contrib.label}</span>
                      <span className="font-medium">{contrib.value}/{contrib.maxValue}</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${contrib.color} transition-all duration-700 ease-out rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benchmark */}
          <div className="p-4 bg-background/80 rounded-lg border border-border/50">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-creative mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-1">
                  Sei sopra al <strong className="text-creative">{benchmark}%</strong> dei brand testati
                </p>
                <p className="text-xs text-muted-foreground">
                  Il punteggio medio dei brand nel tuo settore è 52/100
                </p>
              </div>
            </div>
          </div>

          {/* Improvement Suggestion */}
          {improvementSuggestion && (
            <div className="p-4 bg-creative/10 rounded-lg border border-creative/20">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-creative mt-0.5 animate-pulse-glow" />
                <div>
                  <p className="text-sm font-medium mb-1">
                    Con <strong className="text-creative">{improvementSuggestion.actions} interventi</strong> puoi 
                    arrivare a <strong className="text-creative">+{improvementSuggestion.potentialGain} punti</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Consulta le raccomandazioni in fondo alla pagina per prioritizzare le azioni
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
