import { useEffect, useState } from "react";
import { Check, Loader2, Globe, Search, Brain, FileText } from "lucide-react";
import { Progress } from "./ui/progress";

export type AnalysisStep = 
  | "loading-page" 
  | "technical-analysis" 
  | "chatgpt-test" 
  | "claude-test" 
  | "gemini-test" 
  | "generating-report" 
  | "complete";

interface AnalysisProgressProps {
  currentStep?: AnalysisStep;
}

const steps = [
  {
    id: "loading-page" as AnalysisStep,
    label: "Caricamento Pagina",
    description: "Recupero contenuto e metadati",
    icon: Globe,
    estimatedSeconds: 5,
  },
  {
    id: "technical-analysis" as AnalysisStep,
    label: "Analisi Tecnica SEO",
    description: "Verifica schema markup e ottimizzazioni",
    icon: Search,
    estimatedSeconds: 8,
  },
  {
    id: "chatgpt-test" as AnalysisStep,
    label: "Test ChatGPT",
    description: "Verifica raccomandazioni OpenAI",
    icon: Brain,
    estimatedSeconds: 12,
  },
  {
    id: "claude-test" as AnalysisStep,
    label: "Test Claude",
    description: "Verifica raccomandazioni Anthropic",
    icon: Brain,
    estimatedSeconds: 12,
  },
  {
    id: "gemini-test" as AnalysisStep,
    label: "Test Gemini",
    description: "Verifica raccomandazioni Google",
    icon: Brain,
    estimatedSeconds: 12,
  },
  {
    id: "generating-report" as AnalysisStep,
    label: "Generazione Report",
    description: "Calcolo punteggio e raccomandazioni",
    icon: FileText,
    estimatedSeconds: 5,
  },
];

const AnalysisProgress = ({ currentStep = "loading-page" }: AnalysisProgressProps) => {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const totalSteps = steps.length;
  const progressPercentage = currentStep === "complete" 
    ? 100 
    : Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Smooth progress bar animation
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= progressPercentage) return progressPercentage;
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [progressPercentage]);

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStepStatus = (stepId: AnalysisStep): "complete" | "current" | "pending" => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex < currentStepIndex) return "complete";
    if (stepIndex === currentStepIndex) return "current";
    return "pending";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl">
      <div className="space-y-8 animate-fade-in">
        {/* Header con progress bar */}
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="w-20 h-20 border-4 border-muted rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div>
            <h2 className="text-3xl font-serif font-medium mb-2">
              Analisi Agent‑Grade in corso
            </h2>
            <p className="text-muted-foreground mb-1">
              Tempo trascorso: {formatTime(elapsedTime)}
            </p>
            <p className="text-sm text-muted-foreground">
              Stiamo interrogando i principali assistenti AI per verificare se raccomandano il tuo brand
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Step {currentStepIndex + 1} di {totalSteps}
              </span>
              <span className="text-sm font-medium text-creative">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Step Cards */}
        <div className="space-y-3">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`
                  relative p-5 rounded-xl border-2 transition-all duration-300
                  ${status === "pending" ? "bg-muted/20 border-muted" : ""}
                  ${status === "current" ? "bg-creative/5 border-creative shadow-lg scale-[1.02]" : ""}
                  ${status === "complete" ? "bg-success/5 border-success" : ""}
                `}
              >
                <div className="flex items-center gap-4">
                  {/* Icon/Status */}
                  <div className={`
                    flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all
                    ${status === "pending" ? "bg-muted" : ""}
                    ${status === "current" ? "bg-creative/10 animate-pulse-glow" : ""}
                    ${status === "complete" ? "bg-success/10" : ""}
                  `}>
                    {status === "complete" && (
                      <Check className="w-6 h-6 text-success animate-scale-in" />
                    )}
                    {status === "current" && (
                      <Loader2 className="w-6 h-6 text-creative animate-spin" />
                    )}
                    {status === "pending" && (
                      <Icon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`
                        font-medium transition-colors
                        ${status === "pending" ? "text-muted-foreground" : ""}
                        ${status === "current" ? "text-creative" : ""}
                        ${status === "complete" ? "text-success" : ""}
                      `}>
                        {step.label}
                      </h3>
                      {status === "current" && (
                        <span className="text-xs px-2 py-0.5 bg-creative/10 text-creative rounded-full animate-pulse">
                          in corso...
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>

                  {/* Estimated time */}
                  {status === "pending" && (
                    <div className="text-xs text-muted-foreground">
                      ~{step.estimatedSeconds}s
                    </div>
                  )}
                  {status === "complete" && (
                    <div className="text-xs text-success font-medium">
                      ✓
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> L'analisi richiede solitamente 45-60 secondi. I tempi possono variare in base alla complessità della pagina e alla disponibilità dei modelli AI.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisProgress;
