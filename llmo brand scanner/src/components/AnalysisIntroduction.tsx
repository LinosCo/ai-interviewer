import { Search, Cpu, CheckSquare, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export const AnalysisIntroduction = () => {
  const steps = [
    {
      icon: Search,
      title: "Estrazione",
      description: "Analizziamo il tuo sito per estrarre brand, prodotto e informazioni chiave"
    },
    {
      icon: Cpu,
      title: "Test AI",
      description: "Testiamo 5+ assistenti AI con domande reali dei tuoi potenziali clienti"
    },
    {
      icon: CheckSquare,
      title: "Verifiche tecniche",
      description: "Controlliamo schema markup, meta tags e ottimizzazioni per AI"
    },
    {
      icon: TrendingUp,
      title: "Azioni consigliate",
      description: "Ti suggeriamo interventi prioritari per migliorare la visibilità"
    }
  ];

  return (
    <Card className="p-8 mb-8 border-l-4 border-l-creative bg-gradient-to-br from-background via-background to-creative/5">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          Come interpretiamo i risultati
        </h2>
        <p className="text-muted-foreground">
          Il <strong>punteggio di visibilità</strong> misura quanto gli assistenti AI riconoscono e raccomandano 
          il tuo brand quando i clienti fanno domande rilevanti. Più alto è il punteggio, più sei visibile nelle 
          conversazioni con ChatGPT, Claude, Gemini e altri assistenti.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-creative to-creative/60 flex items-center justify-center mb-3 shadow-lg shadow-creative/20 animate-fade-in">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="w-full h-1 bg-gradient-to-r from-creative/30 to-creative/10 rounded-full mb-3" />
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-gradient-to-r from-creative/50 to-transparent" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-border/50">
        <p className="text-sm text-muted-foreground text-center">
          <strong className="text-foreground">Perché è importante?</strong> Il 67% degli utenti si fida dei suggerimenti 
          degli assistenti AI. Se non sei visibile, perdi opportunità di business ogni giorno.
        </p>
      </div>
    </Card>
  );
};
