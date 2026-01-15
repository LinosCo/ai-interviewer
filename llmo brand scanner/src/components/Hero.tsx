import { Search, Zap, BarChart3, Sparkles } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import chatgptLogo from "@/assets/chatgpt-logo.svg";
import claudeLogo from "@/assets/claude-logo.png";
import geminiLogo from "@/assets/gemini-logo.svg";

const Hero = () => {
  const { isAdmin } = useIsAdmin();

  return (
    <section className="relative bg-gradient-to-br from-primary via-[hsl(0,0%,15%)] to-[hsl(16,100%,20%)] text-primary-foreground py-24 md:py-32 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-creative/10 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-creative/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="container mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-creative/10 border border-creative/30 rounded-full mb-6 animate-fade-in">
          <Sparkles className="w-4 h-4 text-creative" />
          <span className="text-sm font-medium text-creative">Analisi Agent‑Grade</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight animate-fade-in">
          Analisi Agent‑Grade del tuo prodotto o servizio
        </h1>
        
        <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 max-w-4xl mx-auto mb-8 leading-relaxed animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Scopri se il tuo brand, prodotto o servizio viene capito, citato e consigliato da ChatGPT, Claude, Gemini e altri assistenti quando i tuoi clienti fanno domande nel tuo settore.
        </p>

        {/* LLM Badges */}
        <div className="flex items-center justify-center gap-4 mb-4 flex-wrap animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-primary-foreground/10 border-primary-foreground/30 hover:border-creative/50 transition-all hover:scale-105">
            <img src={chatgptLogo} alt="ChatGPT" className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">ChatGPT</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-primary-foreground/10 border-primary-foreground/30 hover:border-creative/50 transition-all hover:scale-105">
            <img src={claudeLogo} alt="Claude" className="w-4 h-4 rounded-sm" />
            <span className="text-sm font-medium text-primary-foreground">Claude</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-primary-foreground/10 border-primary-foreground/30 hover:border-creative/50 transition-all hover:scale-105">
            <img src={geminiLogo} alt="Gemini" className="w-4 h-4" />
            <span className="text-sm font-medium text-primary-foreground">Gemini</span>
          </div>
        </div>
        
        <p className="text-base text-primary-foreground/80 mb-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          Pensato per brand di prodotto, aziende B2B e realtà creative.
        </p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="flex items-center gap-3 group">
            <div className="p-2 rounded-lg bg-creative/10 group-hover:bg-creative/20 transition-all">
              <Search className="w-6 h-6 text-primary-foreground group-hover:text-creative transition-colors" />
            </div>
            <span className="text-base md:text-lg">Test su 5+ assistenti AI</span>
          </div>
          
          <div className="flex items-center gap-3 group">
            <div className="p-2 rounded-lg bg-creative/10 group-hover:bg-creative/20 transition-all">
              <Zap className="w-6 h-6 text-primary-foreground group-hover:text-creative transition-colors" />
            </div>
            <span className="text-base md:text-lg">Risultati in 60 secondi</span>
          </div>
          
          <div className="flex items-center gap-3 group">
            <div className="p-2 rounded-lg bg-creative/10 group-hover:bg-creative/20 transition-all">
              <BarChart3 className="w-6 h-6 text-primary-foreground group-hover:text-creative transition-colors" />
            </div>
            <span className="text-base md:text-lg">Report dettagliato e azioni da fare</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
