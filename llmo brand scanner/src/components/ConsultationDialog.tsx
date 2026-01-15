import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteUrl?: string;
  visibilityScore?: number;
}

const ConsultationDialog = ({ open, onOpenChange, siteUrl, visibilityScore }: ConsultationDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call edge function to send consultation request email
      const { error } = await supabase.functions.invoke("send-consultation-request", {
        body: {
          ...formData,
          siteUrl,
          visibilityScore,
        },
      });

      if (error) throw error;

      toast({
        title: "Richiesta Inviata!",
        description: "Ti contatteremo presto per organizzare la consulenza.",
      });

      // Reset form and close dialog
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        message: "",
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending consultation request:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nell'invio della richiesta. Riprova.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif font-medium">Prenota Consulenza Gratuita</DialogTitle>
          <DialogDescription className="text-base">
            Compila il form per richiedere una consulenza personalizzata sulla visibilità AI del tuo brand.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome e Cognome *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Mario Rossi"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="mario@esempio.it"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Azienda</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome azienda"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+39 123 456 7890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Messaggio</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Descrivi brevemente le tue esigenze..."
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Invio...
                </>
              ) : (
                "Invia Richiesta"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConsultationDialog;
