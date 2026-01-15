import { Target, Users, MapPin, Tag, Lightbulb, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductAnalysisVisualProps {
  productAnalysis: {
    mainFunction: string;
    needs: { primary: string[], secondary: string[] };
    contexts: string[];
    clusters: string[];
    queries: string[];
  };
}

export const ProductAnalysisVisual = ({ productAnalysis }: ProductAnalysisVisualProps) => {
  // Determine AI clarity perception based on data completeness
  const calculateAIClarity = () => {
    let score = 0;
    if (productAnalysis.mainFunction) score += 30;
    if (productAnalysis.needs.primary.length > 0) score += 30;
    if (productAnalysis.needs.secondary.length > 0) score += 20;
    if (productAnalysis.contexts.length > 0) score += 20;

    if (score >= 80) return { level: "Alta", color: "text-success", bg: "bg-success/10", description: "Gli AI comprendono chiaramente il tuo prodotto" };
    if (score >= 50) return { level: "Media", color: "text-warning", bg: "bg-warning/10", description: "Gli AI hanno una comprensione parziale" };
    return { level: "Bassa", color: "text-error", bg: "bg-error/10", description: "Gli AI faticano a comprendere il tuo prodotto" };
  };

  const clarity = calculateAIClarity();

  return (
    <div className="mb-12">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Target className="w-8 h-8 text-creative" />
        Analisi Prodotto/Servizio
      </h2>

      {/* AI Clarity Box */}
      <Card className={`p-6 mb-8 border-l-4 border-l-creative ${clarity.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className={`w-5 h-5 ${clarity.color}`} />
              <h3 className="text-lg font-semibold">Chiarezza percepita dagli AI</h3>
            </div>
            <p className="text-sm text-muted-foreground">{clarity.description}</p>
          </div>
          <div className={`text-3xl font-bold ${clarity.color}`}>
            {clarity.level}
          </div>
        </div>
      </Card>

      {/* Main Function */}
      {productAnalysis.mainFunction && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-creative/5 to-creative/10 border-creative/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-creative/20">
              <Target className="w-5 h-5 text-creative" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Funzione Principale</h3>
              <p className="text-muted-foreground">{productAnalysis.mainFunction}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Needs Matrix */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Primary Needs */}
        <Card className="p-6 border-l-4 border-l-success">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h3 className="font-semibold">Bisogni Primari</h3>
          </div>
          <div className="space-y-2">
            {productAnalysis.needs.primary.map((need, index) => (
              <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <span className="text-success mt-1">•</span>
                <span className="text-sm">{need}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Secondary Needs */}
        <Card className="p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Bisogni Secondari</h3>
          </div>
          <div className="space-y-2">
            {productAnalysis.needs.secondary.map((need, index) => (
              <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <span className="text-blue-500 mt-1">•</span>
                <span className="text-sm">{need}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Contexts */}
      {productAnalysis.contexts.length > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-creative" />
            <h3 className="font-semibold">Contesti d'Uso</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {productAnalysis.contexts.map((context, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="px-4 py-2 text-sm bg-creative/5 border-creative/30 hover:bg-creative/10"
              >
                <MapPin className="w-3 h-3 mr-1" />
                {context}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Clusters */}
      {productAnalysis.clusters.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-creative" />
            <h3 className="font-semibold">Categorie di Bisogno</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {productAnalysis.clusters.map((cluster, index) => (
              <Badge 
                key={index} 
                className="px-5 py-2.5 text-base bg-gradient-to-r from-creative to-creative/80 text-white hover:shadow-lg hover:shadow-creative/20 transition-all"
              >
                {cluster}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
