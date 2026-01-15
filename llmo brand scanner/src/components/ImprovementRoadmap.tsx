import { TrendingUp, AlertCircle, Info, Clock, Zap, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Recommendation {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  impact: string;
}

interface ImprovementRoadmapProps {
  recommendations: Recommendation[];
}

interface EnrichedRecommendation extends Recommendation {
  estimatedScoreImpact: number;
  aiVisibilityImpact: "Alto" | "Medio" | "Basso";
  estimatedTime: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export const ImprovementRoadmap = ({ recommendations }: ImprovementRoadmapProps) => {
  
  // Enrich recommendations with additional metadata
  const enrichRecommendations = (): EnrichedRecommendation[] => {
    return recommendations.map(rec => {
      // Calculate estimated score impact based on priority and description
      let scoreImpact = 0;
      let aiImpact: "Alto" | "Medio" | "Basso" = "Medio";
      let time = "2-4 ore";
      let difficulty: 1 | 2 | 3 | 4 | 5 = 3;

      if (rec.priority === "critical") {
        scoreImpact = 15;
        aiImpact = "Alto";
        time = "4-8 ore";
        difficulty = 4;
      } else if (rec.priority === "high") {
        scoreImpact = 10;
        aiImpact = "Alto";
        time = "2-4 ore";
        difficulty = 3;
      } else {
        scoreImpact = 5;
        aiImpact = "Medio";
        time = "1-2 ore";
        difficulty = 2;
      }

      // Adjust based on keywords in description
      const desc = rec.description.toLowerCase();
      if (desc.includes('schema') || desc.includes('json-ld') || desc.includes('structured')) {
        aiImpact = "Alto";
        scoreImpact += 5;
        difficulty = Math.min(5, difficulty + 1) as 1 | 2 | 3 | 4 | 5;
      }
      if (desc.includes('meta') || desc.includes('description')) {
        time = "30 min - 1 ora";
        difficulty = 1;
      }

      return {
        ...rec,
        estimatedScoreImpact: scoreImpact,
        aiVisibilityImpact: aiImpact,
        estimatedTime: time,
        difficulty
      };
    });
  };

  const enrichedRecommendations = enrichRecommendations();

  // Group by priority
  const criticalRecs = enrichedRecommendations.filter(r => r.priority === "critical");
  const highRecs = enrichedRecommendations.filter(r => r.priority === "high");
  const mediumRecs = enrichedRecommendations.filter(r => r.priority === "medium");

  const getPriorityConfig = (priority: string) => {
    if (priority === "critical") return {
      label: "Priorità Alta",
      color: "text-error",
      bgColor: "bg-error/10",
      borderColor: "border-error",
      icon: AlertCircle
    };
    if (priority === "high") return {
      label: "Priorità Media",
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning",
      icon: TrendingUp
    };
    return {
      label: "Priorità Bassa",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500",
      icon: Info
    };
  };

  const getAIImpactColor = (impact: string) => {
    if (impact === "Alto") return "text-creative";
    if (impact === "Medio") return "text-warning";
    return "text-muted-foreground";
  };

  const renderDifficultyStars = (difficulty: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full ${i <= difficulty ? 'bg-creative' : 'bg-muted'}`}
          />
        ))}
      </div>
    );
  };

  const renderPriorityGroup = (recs: EnrichedRecommendation[], priority: string) => {
    if (recs.length === 0) return null;

    const config = getPriorityConfig(priority);
    const PriorityIcon = config.icon;

    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <PriorityIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <h3 className="text-xl font-semibold">{config.label}</h3>
          <Badge variant="outline" className="ml-2">
            {recs.length} {recs.length === 1 ? "intervento" : "interventi"}
          </Badge>
        </div>

        <div className="space-y-4">
          {recs.map((rec, index) => (
            <Card key={index} className={`p-6 border-l-4 ${config.borderColor} hover:shadow-lg transition-shadow`}>
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold mb-2">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>
                  </div>
                  <Badge className={`${config.bgColor} ${config.color} border border-current`}>
                    +{rec.estimatedScoreImpact} punti
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Impatto AI</span>
                    </div>
                    <p className={`text-sm font-semibold ${getAIImpactColor(rec.aiVisibilityImpact)}`}>
                      {rec.aiVisibilityImpact}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tempo stimato</span>
                    </div>
                    <p className="text-sm font-semibold">{rec.estimatedTime}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Difficoltà</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderDifficultyStars(rec.difficulty)}
                      <span className="text-xs text-muted-foreground">{rec.difficulty}/5</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Impatto Punteggio</span>
                    </div>
                    <p className="text-sm font-semibold text-creative">+{rec.estimatedScoreImpact}</p>
                  </div>
                </div>

                {/* Impact Description */}
                <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}/20`}>
                  <p className="text-xs text-muted-foreground">
                    <strong>Perché è importante:</strong> {rec.impact}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-creative" />
        Roadmap di Miglioramento
      </h2>
      <p className="text-muted-foreground mb-8">
        Interventi prioritari per aumentare la tua visibilità negli assistenti AI
      </p>

      {/* Summary Card */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-creative/10 to-creative/5 border-creative/20">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-error mb-1">{criticalRecs.length}</div>
            <div className="text-sm text-muted-foreground">Interventi ad alta priorità</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-warning mb-1">{highRecs.length}</div>
            <div className="text-sm text-muted-foreground">Interventi a media priorità</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-creative mb-1">
              +{enrichedRecommendations.reduce((sum, r) => sum + r.estimatedScoreImpact, 0)}
            </div>
            <div className="text-sm text-muted-foreground">Punti potenziali totali</div>
          </div>
        </div>
      </Card>

      {/* Priority Groups */}
      {renderPriorityGroup(criticalRecs, "critical")}
      {renderPriorityGroup(highRecs, "high")}
      {renderPriorityGroup(mediumRecs, "medium")}
    </div>
  );
};
