import { useState } from "react";
import { MessageSquare, AlertTriangle, Eye, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NeedBasedPromptsSectionProps {
  queries: string[];
  clusters: string[];
  platformResults?: Array<{
    name: string;
    query: string;
    mentioned: boolean;
    partial: boolean;
  }>;
}

interface EnrichedPrompt {
  query: string;
  cluster: string;
  competitorRisk: "Basso" | "Medio" | "Alto";
  brandVisibility: 0 | 1 | 2 | 3;
  icon: string;
}

export const NeedBasedPromptsSection = ({ 
  queries, 
  clusters,
  platformResults = []
}: NeedBasedPromptsSectionProps) => {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Assign clusters to queries
  const assignClusterToQuery = (query: string, index: number): string => {
    if (clusters.length === 0) return "Generale";
    return clusters[index % clusters.length];
  };

  // Calculate brand visibility for each query
  const calculateBrandVisibility = (query: string): 0 | 1 | 2 | 3 => {
    // Check if this query was tested
    const result = platformResults.find(r => r.query === query);
    if (!result) return 0;
    
    if (result.mentioned) return 3; // Esplicita
    if (result.partial) return 2; // Parziale
    return 1; // Assente ma testata
  };

  // Calculate competitor risk (simplified heuristic)
  const calculateCompetitorRisk = (query: string): "Basso" | "Medio" | "Alto" => {
    const visibility = calculateBrandVisibility(query);
    if (visibility === 3) return "Basso";
    if (visibility === 2) return "Medio";
    return "Alto";
  };

  // Get icon based on query content
  const getQueryIcon = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("migliore") || lowerQuery.includes("top")) return "🏆";
    if (lowerQuery.includes("economico") || lowerQuery.includes("prezzo")) return "💰";
    if (lowerQuery.includes("professionale") || lowerQuery.includes("business")) return "💼";
    if (lowerQuery.includes("casa") || lowerQuery.includes("domestico")) return "🏠";
    if (lowerQuery.includes("veloce") || lowerQuery.includes("rapido")) return "⚡";
    if (lowerQuery.includes("qualità") || lowerQuery.includes("premium")) return "⭐";
    return "💡";
  };

  // Enrich queries with metadata
  const enrichedQueries: EnrichedPrompt[] = queries.map((query, index) => ({
    query,
    cluster: assignClusterToQuery(query, index),
    competitorRisk: calculateCompetitorRisk(query),
    brandVisibility: calculateBrandVisibility(query),
    icon: getQueryIcon(query)
  }));

  // Group by cluster
  const groupedByCluster = enrichedQueries.reduce((acc, prompt) => {
    if (!acc[prompt.cluster]) {
      acc[prompt.cluster] = [];
    }
    acc[prompt.cluster].push(prompt);
    return acc;
  }, {} as Record<string, EnrichedPrompt[]>);

  const getRiskColor = (risk: string) => {
    if (risk === "Alto") return "text-error";
    if (risk === "Medio") return "text-warning";
    return "text-success";
  };

  const getRiskBg = (risk: string) => {
    if (risk === "Alto") return "bg-error/10 border-error/30";
    if (risk === "Medio") return "bg-warning/10 border-warning/30";
    return "bg-success/10 border-success/30";
  };

  const getVisibilityBadge = (visibility: number) => {
    if (visibility === 3) return { text: "Menzionato", color: "bg-success text-success-foreground" };
    if (visibility === 2) return { text: "Parziale", color: "bg-warning text-warning-foreground" };
    if (visibility === 1) return { text: "Assente", color: "bg-error text-error-foreground" };
    return { text: "Non testato", color: "bg-muted text-muted-foreground" };
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-creative" />
        Prompt Need-Based
      </h2>

      <Card className="p-6 mb-6 bg-gradient-to-br from-creative/5 to-creative/10 border-creative/20">
        <p className="text-sm text-muted-foreground">
          Questi sono i <strong>{queries.length} prompt</strong> generati basandoci sui bisogni dei tuoi clienti. 
          Ogni prompt rappresenta una domanda reale che un potenziale cliente potrebbe fare agli assistenti AI.
        </p>
      </Card>

      <div className="space-y-4">
        {Object.entries(groupedByCluster).map(([cluster, prompts]) => {
          const isExpanded = expandedCluster === cluster;
          const avgRisk = prompts.filter(p => p.competitorRisk === "Alto").length > prompts.length / 2 ? "Alto" : 
                         prompts.filter(p => p.competitorRisk === "Medio").length > prompts.length / 2 ? "Medio" : "Basso";
          
          return (
            <Card key={cluster} className="overflow-hidden">
              <div 
                className="p-6 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCluster(isExpanded ? null : cluster)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-creative" />
                      <h3 className="text-xl font-semibold">{cluster}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
                    </Badge>
                    <Badge className={`text-xs ${getRiskBg(avgRisk)} ${getRiskColor(avgRisk)} border`}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Rischio {avgRisk}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-3 border-t border-border pt-6 animate-fade-in">
                  {prompts.map((prompt, index) => {
                    const visibilityBadge = getVisibilityBadge(prompt.brandVisibility);
                    
                    return (
                      <div 
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${getRiskBg(prompt.competitorRisk)} border-l-creative hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{prompt.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-2 leading-relaxed">
                              "{prompt.query}"
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${getRiskBg(prompt.competitorRisk)} ${getRiskColor(prompt.competitorRisk)} border`}>
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Rischio {prompt.competitorRisk}
                              </Badge>
                              <Badge className={`text-xs ${visibilityBadge.color}`}>
                                <Eye className="w-3 h-3 mr-1" />
                                {visibilityBadge.text}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
