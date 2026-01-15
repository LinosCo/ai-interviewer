import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Globe, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

interface AnalysisFormProps {
  onSubmit: (data: FormData) => void;
}

export interface FormData {
  url: string;
  market: string;
  category: string;
  userEmail?: string;
}

const marketLabels: Record<string, string> = {
  Italia: "🇮🇹 Italia",
  Europa: "🇪🇺 Europa",
  USA: "🇺🇸 USA",
  Globale: "🌍 Globale",
};

const AnalysisForm = ({ onSubmit }: AnalysisFormProps) => {
  const [formData, setFormData] = useState<FormData>({
    url: "",
    market: "Italia",
    category: "",
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [remainingQueries, setRemainingQueries] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const [urlValidating, setUrlValidating] = useState(false);
  const [urlSuggestion, setUrlSuggestion] = useState<string | null>(null);
  const [extractedDomain, setExtractedDomain] = useState<string | null>(null);

  useEffect(() => {
    checkRemainingQueries();
  }, []);

  const checkRemainingQueries = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      setIsAuthenticated(!!session?.user);

      if (session?.user?.id) {
        // Check if admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();

        const userIsAdmin = roleData?.role === 'admin';
        setIsAdmin(userIsAdmin);

        if (!userIsAdmin) {
          // Count queries
          const { count } = await supabase
            .from('analysis_queries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);

          if (count !== null) {
            setRemainingQueries(Math.max(0, 5 - count));
          }
        }
      }
    } catch (error) {
      console.error('Error checking remaining queries:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.url) {
      newErrors.url = "URL richiesto";
    } else if (!/^https?:\/\/.+\..+/.test(formData.url)) {
      newErrors.url = "Inserisci un URL valido (deve iniziare con http:// o https://)";
    }
    
    if (!formData.market) {
      newErrors.market = "Seleziona un mercato";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const cleanUrl = (url: string): string => {
    // Remove trailing slashes
    let cleaned = url.replace(/\/+$/, '');
    
    // Remove common tracking parameters
    try {
      const urlObj = new URL(cleaned);
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      cleaned = urlObj.toString();
    } catch (e) {
      // If URL parsing fails, return as is
    }
    
    return cleaned;
  };

  const suggestUrlFix = (url: string): string | null => {
    // If URL doesn't start with http/https, suggest adding https://
    if (url && !url.match(/^https?:\/\//i)) {
      return `https://${url}`;
    }
    
    // If URL has excessive parameters, suggest cleaned version
    if (url.includes('?') && (url.match(/&/g) || []).length > 2) {
      const cleaned = cleanUrl(url);
      if (cleaned !== url) {
        return cleaned;
      }
    }
    
    return null;
  };

  const extractDomain = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return null;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData({ ...formData, url });
    
    // Clear error when user starts typing
    if (errors.url) {
      setErrors({ ...errors, url: undefined });
    }

    // Real-time validation and suggestions
    if (url) {
      const suggestion = suggestUrlFix(url);
      setUrlSuggestion(suggestion);
      
      // Extract domain if valid
      const domain = extractDomain(url);
      setExtractedDomain(domain);
      
      // Check if URL is malformed
      if (!/^https?:\/\/.+\..+/.test(url) && url.length > 5) {
        setUrlValidating(true);
      } else {
        setUrlValidating(false);
      }
    } else {
      setUrlSuggestion(null);
      setExtractedDomain(null);
      setUrlValidating(false);
    }
  };

  const applySuggestion = () => {
    if (urlSuggestion) {
      setFormData({ ...formData, url: urlSuggestion });
      setUrlSuggestion(null);
      setExtractedDomain(extractDomain(urlSuggestion));
      setUrlValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="relative -mt-12 md:-mt-20 mb-24 md:mb-32">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto bg-card rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-10 md:p-12 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]">
          {/* Query Limit Badge */}
          {!isAdmin && remainingQueries !== null && (
            <div className={`mb-8 p-5 rounded-lg ${remainingQueries === 0 ? 'bg-error-light' : remainingQueries <= 2 ? 'bg-warning-light' : 'bg-blue-50'}`}>
              <p className={`text-sm font-medium ${remainingQueries === 0 ? 'text-error' : remainingQueries <= 2 ? 'text-warning' : 'text-blue-600'}`}>
                {remainingQueries === 0 
                  ? '⚠️ Hai raggiunto il limite di 5 analisi. Contatta il supporto per aumentare il limite.'
                  : `📊 Ti rimangono ${remainingQueries} ${remainingQueries === 1 ? 'analisi' : 'analisi'} disponibili`
                }
              </p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* URL Input */}
            <div className="space-y-3">
              <Label htmlFor="url" className="text-base font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-creative" />
                URL della pagina da analizzare
              </Label>
              <div className="relative">
                <Input
                  id="url"
                  type="url"
                  placeholder="https://www.esempio.com/prodotto"
                  value={formData.url}
                  onChange={handleUrlChange}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  className={`h-14 text-base pl-4 pr-12 transition-all ${
                    urlFocused 
                      ? "border-creative ring-2 ring-creative/20" 
                      : errors.url 
                      ? "border-error" 
                      : extractedDomain
                      ? "border-success"
                      : "border-border"
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {urlValidating && formData.url && (
                    <AlertCircle className="w-5 h-5 text-warning animate-pulse" />
                  )}
                  {extractedDomain && !urlValidating && (
                    <CheckCircle2 className="w-5 h-5 text-success animate-scale-in" />
                  )}
                </div>
              </div>

              {/* URL Suggestion */}
              {urlSuggestion && !errors.url && (
                <div className="flex items-start gap-3 p-4 bg-creative-light rounded-lg border border-creative/30 animate-slide-up">
                  <Sparkles className="w-5 h-5 text-creative flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Suggerimento URL
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Abbiamo notato che l'URL potrebbe essere migliorato:
                    </p>
                    <code className="block text-xs bg-card p-2 rounded border border-border overflow-x-auto mb-3">
                      {urlSuggestion}
                    </code>
                    <Button
                      type="button"
                      onClick={applySuggestion}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-creative text-creative hover:bg-creative hover:text-white"
                    >
                      Usa URL suggerito
                    </Button>
                  </div>
                </div>
              )}

              {/* Extracted Domain Preview */}
              {extractedDomain && !urlSuggestion && (
                <div className="flex items-center gap-2 text-sm text-success bg-success-light p-3 rounded-lg animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <p>
                    <strong>Dominio rilevato:</strong> {extractedDomain}
                  </p>
                </div>
              )}

              {errors.url && (
                <div className="flex items-center gap-2 text-sm text-error bg-error-light p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{errors.url}</p>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-creative">✓</span>
                <span>Il brand, prodotto o servizio verranno estratti automaticamente dalla pagina</span>
              </p>

              {/* URL Examples - show only when field is empty or has error */}
              {(!formData.url || errors.url) && (
                <details className="group animate-fade-in">
                  <summary className="text-sm text-creative cursor-pointer hover:underline list-none flex items-center gap-2">
                    <span>Vedi esempi di URL validi</span>
                    <span className="transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <div className="text-xs space-y-2 p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-success">URL corretti:</p>
                          <code className="block text-muted-foreground mt-1">https://www.esempio.com/prodotto</code>
                          <code className="block text-muted-foreground">https://shop.esempio.it/categoria/articolo</code>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-error">Da evitare:</p>
                          <code className="block text-muted-foreground mt-1">esempio.com (manca https://)</code>
                          <code className="block text-muted-foreground">www.esempio.com (manca https://)</code>
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-3 flex items-start gap-1">
                        <Sparkles className="w-3 h-3 text-creative flex-shrink-0 mt-0.5" />
                        <span>Parametri di tracciamento (utm_*, fbclid) verranno rimossi automaticamente</span>
                      </p>
                    </div>
                  </div>
                </details>
              )}
            </div>

            {/* Market Select */}
            <div className="space-y-3">
              <Label htmlFor="market" className="text-base font-medium">
                Mercato principale
              </Label>
              <div className="relative">
                <Select 
                  value={formData.market} 
                  onValueChange={(value) => setFormData({ ...formData, market: value })}
                >
                  <SelectTrigger 
                    id="market" 
                    className="h-14 text-base border-border hover:border-creative/50 transition-all"
                  >
                    <SelectValue>
                      {marketLabels[formData.market] || "Seleziona mercato"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    <SelectItem value="Italia" className="cursor-pointer hover:bg-muted">
                      {marketLabels.Italia}
                    </SelectItem>
                    <SelectItem value="Europa" className="cursor-pointer hover:bg-muted">
                      {marketLabels.Europa}
                    </SelectItem>
                    <SelectItem value="USA" className="cursor-pointer hover:bg-muted">
                      {marketLabels.USA}
                    </SelectItem>
                    <SelectItem value="Globale" className="cursor-pointer hover:bg-muted">
                      {marketLabels.Globale}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-creative">ℹ️</span>
                <span>Ci aiuta a generare domande contestualizzate per il tuo mercato di riferimento</span>
              </p>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={!isAdmin && remainingQueries === 0}
              className="w-full h-16 text-lg font-medium gap-3 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl bg-gradient-to-r from-primary to-primary/90 hover:from-creative hover:to-creative/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Search className="w-6 h-6" />
              {!isAdmin && remainingQueries === 0 ? 'Limite Raggiunto' : 'Fai il test Agent‑Grade'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AnalysisForm;
