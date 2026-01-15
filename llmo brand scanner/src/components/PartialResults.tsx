import { CheckCircle2, XCircle, AlertCircle, Lock } from "lucide-react";
import { Button } from "./ui/button";

interface PartialResultsProps {
  data: {
    siteInfo: {
      url: string;
      title: string;
      favicon?: string;
    };
    visibilityScore: number;
    technicalChecks: Array<{
      name: string;
      status: "pass" | "warning" | "fail";
      description: string;
    }>;
  };
  onSignup: () => void;
}

const PartialResults = ({ data, onSignup }: PartialResultsProps) => {
  // Add safety checks for data
  if (!data || !data.siteInfo || typeof data.visibilityScore === 'undefined') {
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
          <p className="text-error">Errore nel caricamento dei risultati. Dati mancanti.</p>
          <Button onClick={onSignup} className="mt-4">Registrati</Button>
        </div>
      </div>
    );
  }
  
  const getRating = (score: number) => {
    if (score >= 80) return { text: "Eccellente", color: "text-success" };
    if (score >= 60) return { text: "Buono", color: "text-primary" };
    if (score >= 40) return { text: "Medio", color: "text-warning" };
    return { text: "Basso", color: "text-error" };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-error" />;
      default:
        return null;
    }
  };

  const rating = getRating(data.visibilityScore ?? 0);
  
  // Safe access to site data with fallbacks
  const siteData = data.siteInfo || { url: '', title: 'Analisi in corso...', favicon: null };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Site Header */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-10">
        <div className="flex items-start gap-6">
          {siteData.favicon && (
            <img
              src={siteData.favicon}
              alt="Site favicon"
              className="w-12 h-12 rounded-lg"
            />
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-serif font-medium mb-2">{siteData.title}</h2>
            <p className="text-muted-foreground break-all">{siteData.url}</p>
          </div>
        </div>
      </div>

      {/* Score Overview */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-10">
        <h3 className="text-xl font-serif font-medium mb-8">Punteggio di Visibilità</h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-6xl font-bold mb-3">{data.visibilityScore ?? 0}</div>
            <div className={`text-lg font-medium ${rating.color}`}>{rating.text}</div>
          </div>
        </div>
      </div>

      {/* Technical Checks Preview (first 3) */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-10">
        <h3 className="text-xl font-serif font-medium mb-8">Controlli Tecnici</h3>
        <div className="space-y-4">
          {(data.technicalChecks || []).slice(0, 3).map((check, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-5 rounded-lg border-l-4 border-border bg-muted/30"
            >
              {getStatusIcon(check.status)}
              <div className="flex-1">
                <div className="font-medium mb-2">{check.name}</div>
                <div className="text-sm text-muted-foreground">{check.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl shadow-sm border border-primary/20 p-10">
        <div className="text-center max-w-2xl mx-auto">
          <Lock className="h-16 w-16 text-primary mx-auto mb-4" />
          <h3 className="text-2xl font-serif italic mb-3">
            Vuoi vedere il report completo?
          </h3>
          <p className="text-gray-700 mb-6">
            Registrati gratuitamente per accedere all'analisi completa con:
          </p>
          <ul className="text-left mb-8 space-y-2 max-w-md mx-auto">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Tutti i controlli tecnici SEO dettagliati</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Analisi completa su ChatGPT e Claude</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Raccomandazioni personalizzate prioritizzate</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Storico delle tue analisi</span>
            </li>
          </ul>
          <Button size="lg" onClick={onSignup} className="text-lg px-8">
            Registrati Gratuitamente
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PartialResults;
