import { Bot, Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const LLMLogos = () => {
  const { isAdmin } = useIsAdmin();
  const llms = [
    { name: "ChatGPT", active: true, color: "text-creative" },
    { name: "Claude", active: true, color: "text-creative" },
    { name: "Gemini", active: true, color: "text-creative" },
    { name: "Perplexity", active: false, color: "text-muted-foreground" },
    { name: "Mistral", active: false, color: "text-muted-foreground" },
    { name: "Cohere", active: false, color: "text-muted-foreground" },
    { name: "Grok", active: false, color: "text-muted-foreground" },
  ];

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-creative animate-pulse-glow" />
          <h2 className="text-2xl md:text-3xl font-bold text-center">
            Testato sui Principali AI
          </h2>
          <Sparkles className="w-6 h-6 text-creative animate-pulse-glow" />
        </div>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Analizziamo la visibilità del tuo brand attraverso i più importanti modelli di intelligenza artificiale
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 max-w-6xl mx-auto">
          {llms.map((llm, index) => {
            // Hide inactive platforms for non-admin users
            if (!llm.active && !isAdmin) return null;
            
            return (
              <div
                key={llm.name}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border transition-all animate-fade-in ${
                  llm.active
                    ? "bg-card border-border hover:border-creative hover:shadow-lg hover:scale-105"
                    : "bg-muted/30 border-muted opacity-60"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="relative">
                  <Bot className={`w-8 h-8 ${llm.active ? llm.color : "text-muted-foreground"}`} />
                  {llm.active && (
                    <Sparkles className="w-3 h-3 text-creative absolute -top-1 -right-1 animate-pulse" />
                  )}
                </div>
                <span className={`text-sm font-medium text-center ${llm.active ? "text-foreground" : "text-muted-foreground"}`}>
                  {llm.name}
                </span>
                {!llm.active && isAdmin && (
                  <span className="text-xs text-muted-foreground">Coming Soon</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LLMLogos;
