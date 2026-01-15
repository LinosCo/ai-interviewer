import { useState } from "react";
import { ChevronDown, CheckCircle2, Search, Brain, FileText, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

const HowItWorks = () => {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      icon: Search,
      title: "Analizziamo la tua pagina",
      description: "Estraiamo automaticamente brand, prodotto/servizio, settore e metadati SEO dalla pagina che ci fornisci.",
    },
    {
      icon: Brain,
      title: "Interroghiamo gli AI",
      description: "Generiamo domande basate sui bisogni reali dei tuoi clienti e le poniamo a ChatGPT, Claude, Gemini e altri assistenti AI.",
    },
    {
      icon: CheckCircle2,
      title: "Rileviamo le menzioni",
      description: "Verifichiamo se e come il tuo brand viene menzionato nelle risposte degli AI quando rispondono a domande del tuo settore.",
    },
    {
      icon: FileText,
      title: "Generiamo il report",
      description: "Calcoliamo il punteggio di visibilità (0-100) e forniamo raccomandazioni concrete per migliorare la tua presenza.",
    },
  ];

  return (
    <div className="container mx-auto px-6 mb-12">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-all border border-border rounded-xl"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-creative" />
            <span className="text-lg font-medium">Come funziona l'analisi Agent‑Grade?</span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>

        {isOpen && (
          <div className="mt-4 p-8 bg-card border border-border rounded-xl animate-slide-up">
            <div className="space-y-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={index}
                    className="flex gap-4 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-creative/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-creative" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground mb-1">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 p-6 bg-creative-light rounded-lg border border-creative/20">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-creative" />
                Esempio di report
              </h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-creative flex-shrink-0 mt-0.5" />
                  <p><strong>Punteggio visibilità:</strong> 65/100 (Buono)</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-creative flex-shrink-0 mt-0.5" />
                  <p><strong>Controlli tecnici:</strong> Schema.org ✓, JSON-LD ✓, Meta tags ⚠️</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-creative flex-shrink-0 mt-0.5" />
                  <p><strong>Test AI:</strong> Menzionato da Claude, non trovato in ChatGPT e Gemini</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-creative flex-shrink-0 mt-0.5" />
                  <p><strong>Raccomandazioni:</strong> Migliorare schema markup, ottimizzare meta description, aumentare backlinks autorevoli</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HowItWorks;
