import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface UpgradeOfferProps {
  queriesUsed: number;
  onUpgrade: () => void;
}

export default function UpgradeOffer({ queriesUsed, onUpgrade }: UpgradeOfferProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container max-w-4xl mx-auto px-6 py-24">
        <Card className="border-2 border-primary/20 shadow-2xl rounded-xl">
          <CardHeader className="text-center space-y-6 pb-10">
            <Badge variant="outline" className="mx-auto w-fit px-5 py-2 text-sm">
              Limite Raggiunto
            </Badge>
            <CardTitle className="text-4xl font-bold">
              Hai utilizzato tutte le tue {queriesUsed} analisi gratuite
            </CardTitle>
            <CardDescription className="text-lg">
              Continua a ottimizzare la tua visibilità AI con il nostro pacchetto premium
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-10">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-10 text-center space-y-6">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm uppercase tracking-wider">
                  Pacchetto Premium
                </p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-bold text-primary">€29</span>
                </div>
                <p className="text-xl font-medium">
                  10 analisi aggiuntive
                </p>
              </div>
              
              <div className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Solo €2.90 per analisi
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Cosa include:</h3>
              <ul className="space-y-3">
                {[
                  "10 analisi complete del tuo brand",
                  "Verifica su tutti i principali LLM (ChatGPT, Claude, Gemini)",
                  "Report tecnici SEO dettagliati",
                  "Suggerimenti personalizzati per migliorare la visibilità",
                  "Esportazione PDF dei risultati",
                  "Storico completo delle analisi"
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 space-y-4">
              <Button 
                onClick={onUpgrade}
                size="lg"
                className="w-full text-lg py-6"
              >
                Acquista 10 analisi per €29
              </Button>
              
              <p className="text-center text-sm text-muted-foreground">
                Pagamento sicuro tramite Stripe
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
