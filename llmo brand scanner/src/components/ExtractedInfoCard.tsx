import { useState } from "react";
import { CheckCircle2, AlertTriangle, Edit3, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExtractedInfoCardProps {
  siteInfo: {
    url: string;
    title: string;
    favicon?: string;
    brandName?: string;
    productName?: string;
  };
}

export const ExtractedInfoCard = ({ siteInfo }: ExtractedInfoCardProps) => {
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctedBrand, setCorrectedBrand] = useState(siteInfo.brandName || "");
  const [correctedProduct, setCorrectedProduct] = useState(siteInfo.productName || "");

  const handleSaveCorrections = () => {
    // In production, this would send corrections to backend
    console.log("Corrections saved:", { brand: correctedBrand, product: correctedProduct });
    setCorrectionDialogOpen(false);
  };

  // Generate thumbnail URL (using a screenshot service or placeholder)
  const getThumbnailUrl = (url: string) => {
    // In production, use a service like screenshotapi.net or similar
    return `https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=1200&viewport_height=800&device_scale_factor=1&image_quality=80&format=jpg&block_ads=true&block_cookie_banners=true&block_trackers=true&delay=0&timeout=60`;
  };

  return (
    <>
      {/* Site Header Card with Thumbnail */}
      <Card className="p-8 mb-8 border-l-4 border-l-creative">
        <div className="grid md:grid-cols-[200px,1fr] gap-8">
          {/* Thumbnail Preview */}
          <div className="space-y-4">
            <div className="w-full aspect-[3/2] rounded-lg overflow-hidden border-2 border-border shadow-md bg-muted/30">
              <img 
                src={getThumbnailUrl(siteInfo.url)} 
                alt={`Preview di ${siteInfo.title}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to generic preview if screenshot fails
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(siteInfo.title)}&size=400&background=FF6B35&color=fff`;
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span className="truncate font-mono">{new URL(siteInfo.url).hostname}</span>
            </div>
          </div>

          {/* Site Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">{siteInfo.title}</h2>
              <p className="text-sm text-muted-foreground font-mono">{siteInfo.url}</p>
            </div>

            {/* Extracted Info */}
            {(siteInfo.brandName || siteInfo.productName) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    Informazioni Estratte
                  </h3>
                  <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit3 className="w-4 h-4" />
                        Correggi queste info
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Correggi le informazioni estratte</DialogTitle>
                        <DialogDescription>
                          Se le informazioni estratte automaticamente non sono corrette, puoi modificarle qui. 
                          Le correzioni verranno utilizzate per migliorare l'analisi.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="brand">Nome Brand</Label>
                          <Input
                            id="brand"
                            value={correctedBrand}
                            onChange={(e) => setCorrectedBrand(e.target.value)}
                            placeholder="Inserisci il nome corretto del brand"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="product">Nome Prodotto/Servizio</Label>
                          <Input
                            id="product"
                            value={correctedProduct}
                            onChange={(e) => setCorrectedProduct(e.target.value)}
                            placeholder="Inserisci il nome corretto del prodotto"
                          />
                        </div>
                        <Button onClick={handleSaveCorrections} className="w-full">
                          Salva correzioni
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Brand */}
                  <div className={`p-4 rounded-lg border-l-4 ${siteInfo.brandName ? 'bg-success/10 border-l-success' : 'bg-muted/30 border-l-muted'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {siteInfo.brandName ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Brand
                      </span>
                    </div>
                    <p className="text-lg font-bold">
                      {siteInfo.brandName || <span className="text-muted-foreground text-base">Non estratto</span>}
                    </p>
                  </div>

                  {/* Product/Service */}
                  <div className={`p-4 rounded-lg border-l-4 ${siteInfo.productName ? 'bg-success/10 border-l-success' : 'bg-muted/30 border-l-muted'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {siteInfo.productName ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Prodotto/Servizio
                      </span>
                    </div>
                    <p className="text-lg font-bold">
                      {siteInfo.productName || <span className="text-muted-foreground text-base">Non specificato</span>}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground italic">
                  Queste informazioni sono state estratte automaticamente e utilizzate per generare le query di test. 
                  Se non sono corrette, puoi correggerle.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </>
  );
};
