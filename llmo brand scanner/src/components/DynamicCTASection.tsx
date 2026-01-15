import { useState } from "react";
import { Globe, Download, Calendar, ArrowRight, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConsultationDialog from "./ConsultationDialog";

interface DynamicCTASectionProps {
  score: number;
  siteUrl?: string;
  onNewTest: () => void;
  onDownloadPDF: () => void;
}

export const DynamicCTASection = ({ 
  score, 
  siteUrl,
  onNewTest, 
  onDownloadPDF 
}: DynamicCTASectionProps) => {
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);

  // Determine CTA strategy based on score
  const getCTAConfig = () => {
    if (score < 60) {
      return {
        title: "Il tuo brand non è ancora riconosciuto dagli assistenti AI",
        subtitle: "Ogni giorno perdi opportunità di business perché i potenziali clienti non ti trovano quando chiedono consigli agli AI.",
        icon: AlertTriangle,
        iconColor: "text-error",
        bgGradient: "from-error/20 via-error/10 to-background",
        primaryCTA: {
          text: "Prenota Consulenza Gratuita",
          description: "Ti aiutiamo a risolvere i problemi più critici",
          variant: "error" as const
        },
        secondaryCTA: {
          text: "Scarica Report Completo",
          description: "Analisi dettagliata e piano d'azione"
        },
        urgency: "Alto",
        message: "Situazione critica: servono interventi urgenti per rendere il tuo brand visibile agli AI"
      };
    }

    if (score >= 60 && score < 80) {
      return {
        title: "Piccole ottimizzazioni possono portarti nella top categoria",
        subtitle: "Sei sulla buona strada, ma c'è margine significativo per migliorare la tua visibilità e superare i competitor.",
        icon: TrendingUp,
        iconColor: "text-warning",
        bgGradient: "from-warning/20 via-warning/10 to-background",
        primaryCTA: {
          text: "Prenota Consulenza Strategica",
          description: "Ottimizza la tua presenza AI",
          variant: "warning" as const
        },
        secondaryCTA: {
          text: "Scarica Roadmap Completa",
          description: "Piano dettagliato per raggiungere l'eccellenza"
        },
        urgency: "Medio",
        message: "Con pochi interventi mirati puoi posizionarti tra i leader del settore"
      };
    }

    return {
      title: "Sei già sopra la media: ora puoi consolidare la leadership",
      subtitle: "Ottimo lavoro! Mantieni e rafforza questa posizione per assicurarti un vantaggio competitivo duraturo.",
      icon: Sparkles,
      iconColor: "text-success",
      bgGradient: "from-success/20 via-success/10 to-background",
      primaryCTA: {
        text: "Consulenza Avanzata",
        description: "Strategie per mantenere il vantaggio",
        variant: "success" as const
      },
      secondaryCTA: {
        text: "Scarica Certificato",
        description: "Report di eccellenza AI visibility"
      },
      urgency: "Basso",
      message: "Continua a monitorare e ottimizzare per mantenere la leadership di mercato"
    };
  };

  const config = getCTAConfig();
  const CTAIcon = config.icon;

  const getButtonVariant = (variant: string) => {
    if (variant === "error") return "bg-error hover:bg-error/90 text-white";
    if (variant === "warning") return "bg-warning hover:bg-warning/90 text-white";
    return "bg-success hover:bg-success/90 text-white";
  };

  return (
    <>
      <Card className={`p-10 bg-gradient-to-br ${config.bgGradient} border-2 border-current ${config.iconColor}`}>
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className={`p-4 rounded-full bg-background/80 ${config.iconColor}`}>
              <CTAIcon className="w-12 h-12" />
            </div>
          </div>

          {/* Title & Subtitle */}
          <div>
            <h2 className="text-3xl font-bold mb-3">{config.title}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">{config.subtitle}</p>
          </div>

          {/* Urgency Badge */}
          <div className="flex justify-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
              config.urgency === "Alto" ? "bg-error/20 text-error" :
              config.urgency === "Medio" ? "bg-warning/20 text-warning" :
              "bg-success/20 text-success"
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                config.urgency === "Alto" ? "bg-error animate-pulse" :
                config.urgency === "Medio" ? "bg-warning animate-pulse" :
                "bg-success"
              }`} />
              Urgenza: {config.urgency}
            </div>
          </div>

          {/* Message Box */}
          <div className={`p-4 rounded-lg ${
            config.urgency === "Alto" ? "bg-error/10 border border-error/20" :
            config.urgency === "Medio" ? "bg-warning/10 border border-warning/20" :
            "bg-success/10 border border-success/20"
          }`}>
            <p className="text-sm text-muted-foreground">{config.message}</p>
          </div>

          {/* CTA Buttons */}
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            {/* Primary CTA */}
            <Button
              size="lg"
              className={`${getButtonVariant(config.primaryCTA.variant)} group h-auto py-4`}
              onClick={() => setConsultationDialogOpen(true)}
            >
              <div className="flex flex-col items-start text-left">
                <div className="flex items-center gap-2 font-semibold text-lg mb-1">
                  <Calendar className="w-5 h-5" />
                  {config.primaryCTA.text}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="text-xs opacity-90">{config.primaryCTA.description}</span>
              </div>
            </Button>

            {/* Secondary CTA */}
            <Button
              size="lg"
              variant="outline"
              className="h-auto py-4 group"
              onClick={onDownloadPDF}
            >
              <div className="flex flex-col items-start text-left">
                <div className="flex items-center gap-2 font-semibold text-lg mb-1">
                  <Download className="w-5 h-5" />
                  {config.secondaryCTA.text}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="text-xs text-muted-foreground">{config.secondaryCTA.description}</span>
              </div>
            </Button>
          </div>

          {/* Tertiary Action */}
          <div className="pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={onNewTest}
              className="gap-2"
            >
              <Globe className="w-4 h-4" />
              Analizza un altro sito
            </Button>
          </div>
        </div>
      </Card>

      {/* Consultation Dialog */}
      <ConsultationDialog
        open={consultationDialogOpen}
        onOpenChange={setConsultationDialogOpen}
        siteUrl={siteUrl}
        visibilityScore={score}
      />
    </>
  );
};
