import { CheckCircle2, AlertTriangle, XCircle, Code2, Search, Wrench, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TechnicalCheck {
  name: string;
  description: string;
  status: "pass" | "warning" | "fail";
  score: number;
}

interface TechnicalChecksGroupedProps {
  technicalChecks: TechnicalCheck[];
}

interface CheckCategory {
  name: string;
  icon: typeof Code2;
  description: string;
  checks: TechnicalCheck[];
  color: string;
  bgColor: string;
}

export const TechnicalChecksGrouped = ({ technicalChecks }: TechnicalChecksGroupedProps) => {
  
  // Categorize checks
  const categorizeChecks = (): CheckCategory[] => {
    const aiVisibilityKeywords = ['schema', 'json-ld', 'organization', 'faq', 'structured'];
    const seoEssentialsKeywords = ['meta', 'description', 'open graph', 'robots', 'sitemap'];
    const technicalHealthKeywords = ['https', 'mobile', 'performance', 'security'];

    const aiVisibility: TechnicalCheck[] = [];
    const seoEssentials: TechnicalCheck[] = [];
    const technicalHealth: TechnicalCheck[] = [];

    technicalChecks.forEach(check => {
      const nameLower = check.name.toLowerCase();
      const descLower = check.description.toLowerCase();
      
      if (aiVisibilityKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))) {
        aiVisibility.push(check);
      } else if (seoEssentialsKeywords.some(kw => nameLower.includes(kw) || descLower.includes(kw))) {
        seoEssentials.push(check);
      } else {
        technicalHealth.push(check);
      }
    });

    return [
      {
        name: "AI Visibility Markup",
        icon: Sparkles,
        description: "Markup e dati strutturati che aiutano gli AI a comprendere il tuo sito",
        checks: aiVisibility,
        color: "text-creative",
        bgColor: "bg-creative/10"
      },
      {
        name: "SEO Essentials",
        icon: Search,
        description: "Elementi SEO fondamentali per la scoperta e l'indicizzazione",
        checks: seoEssentials,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10"
      },
      {
        name: "Technical Health",
        icon: Wrench,
        description: "Salute tecnica generale del sito",
        checks: technicalHealth,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10"
      }
    ];
  };

  const categories = categorizeChecks();

  const getStatusIcon = (status: string) => {
    if (status === "pass") return <CheckCircle2 className="w-5 h-5 text-success" />;
    if (status === "warning") return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-error" />;
  };

  const getStatusColor = (status: string) => {
    if (status === "pass") return "border-l-success bg-success/5";
    if (status === "warning") return "border-l-warning bg-warning/5";
    return "border-l-error bg-error/5";
  };

  const calculateCategoryScore = (checks: TechnicalCheck[]) => {
    if (checks.length === 0) return 0;
    const passedChecks = checks.filter(c => c.status === "pass").length;
    return Math.round((passedChecks / checks.length) * 100);
  };

  const getCategoryScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-error";
  };

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Code2 className="w-8 h-8 text-creative" />
        Verifiche Tecniche
      </h2>

      <div className="space-y-8">
        {categories.map((category, categoryIndex) => {
          const CategoryIcon = category.icon;
          const categoryScore = calculateCategoryScore(category.checks);
          const scoreColor = getCategoryScoreColor(categoryScore);

          return (
            <Card key={categoryIndex} className="overflow-hidden">
              {/* Category Header */}
              <div className={`p-6 ${category.bgColor} border-b border-border`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg bg-background/80 ${category.color}`}>
                      <CategoryIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-1">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${scoreColor}`}>{categoryScore}%</div>
                    <div className="text-xs text-muted-foreground">
                      {category.checks.filter(c => c.status === "pass").length}/{category.checks.length} verifiche
                    </div>
                  </div>
                </div>
              </div>

              {/* Checks List */}
              <div className="p-6 space-y-4">
                {category.checks.length > 0 ? (
                  category.checks.map((check, checkIndex) => (
                    <div
                      key={checkIndex}
                      className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${getStatusColor(check.status)}`}
                    >
                      <div className="mt-0.5">
                        {getStatusIcon(check.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold mb-1">{check.name}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{check.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            check.status === "pass" ? "bg-success/10 text-success border-success/30" :
                            check.status === "warning" ? "bg-warning/10 text-warning border-warning/30" :
                            "bg-error/10 text-error border-error/30"
                          }`}
                        >
                          +{check.score} punti
                        </Badge>
                        {check.status !== "pass" && (
                          <span className="text-xs text-muted-foreground">
                            Impatto: {check.score >= 10 ? "Alto" : check.score >= 5 ? "Medio" : "Basso"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nessuna verifica in questa categoria</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
