import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Globe, Link2, TrendingUp, AlertTriangle, Lightbulb, 
  ExternalLink, Search, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Source {
  id: string;
  domain: string;
  full_url: string | null;
  name: string | null;
  category: string | null;
  trust_score: number | null;
}

interface SourceUsage {
  id: string;
  source_id: string;
  brand_id: string;
  model_id: string;
  run_id: string;
  mention_count: number | null;
  is_competitor_source: boolean | null;
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
}

interface AIModel {
  id: string;
  name: string;
  display_name: string;
}

interface UserProject {
  id: string;
  name: string;
}

interface SourceWithStats extends Source {
  totalCitations: number;
  brandCitations: number;
  competitorCitations: number;
}

interface GapOpportunity {
  source: Source;
  competitorCitations: number;
  competitorBrands: string[];
}

type PeriodFilter = "7" | "30" | "90";
type SourceCategory = "EDITORIAL" | "CORPORATE" | "UGC" | "INSTITUTIONAL" | "OTHER";

const CATEGORY_OPTIONS: { value: SourceCategory; label: string; color: string }[] = [
  { value: "EDITORIAL", label: "Editoriale", color: "bg-blue-500/10 text-blue-600" },
  { value: "CORPORATE", label: "Corporate", color: "bg-purple-500/10 text-purple-600" },
  { value: "UGC", label: "UGC", color: "bg-green-500/10 text-green-600" },
  { value: "INSTITUTIONAL", label: "Istituzionale", color: "bg-amber-500/10 text-amber-600" },
  { value: "OTHER", label: "Altro", color: "bg-gray-500/10 text-gray-600" },
];

const SourcesV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<UserProject | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceUsages, setSourceUsages] = useState<SourceUsage[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);

  // Filters
  const [period, setPeriod] = useState<PeriodFilter>("30");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [competitorBrandId, setCompetitorBrandId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("sources");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await fetchData(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch user's first project
      const { data: projectData } = await supabase
        .from("user_projects")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!projectData) {
        setLoading(false);
        return;
      }
      setProject(projectData);

      // Fetch brands for this project
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, name")
        .eq("project_id", projectData.id);
      
      setBrands(brandsData || []);
      if (brandsData && brandsData.length > 0) {
        setSelectedBrandId(brandsData[0].id);
      }

      // Fetch all active AI models
      const { data: modelsData } = await supabase
        .from("ai_models")
        .select("id, name, display_name")
        .eq("is_active", true);
      
      setModels(modelsData || []);

      // Fetch all sources
      const { data: sourcesData } = await supabase
        .from("sources")
        .select("id, domain, full_url, name, category, trust_score");
      
      setSources(sourcesData || []);

      // Fetch source usages for brands in this project
      if (brandsData && brandsData.length > 0) {
        const brandIds = brandsData.map(b => b.id);
        const { data: usagesData } = await supabase
          .from("source_usages")
          .select("id, source_id, brand_id, model_id, run_id, mention_count, is_competitor_source, created_at")
          .in("brand_id", brandIds);
        
        setSourceUsages(usagesData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter usages by period and model
  const filteredUsages = useMemo(() => {
    const now = new Date();
    const periodDays = parseInt(period);
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    return sourceUsages.filter(usage => {
      const usageDate = new Date(usage.created_at);
      const matchesPeriod = usageDate >= startDate;
      const matchesModel = selectedModelId === "all" || usage.model_id === selectedModelId;
      return matchesPeriod && matchesModel;
    });
  }, [sourceUsages, period, selectedModelId]);

  // Calculate source stats
  const sourcesWithStats = useMemo((): SourceWithStats[] => {
    return sources
      .map(source => {
        const sourceUsagesForSource = filteredUsages.filter(u => u.source_id === source.id);
        
        const totalCitations = sourceUsagesForSource.reduce(
          (sum, u) => sum + (u.mention_count || 0), 0
        );
        
        const brandCitations = sourceUsagesForSource
          .filter(u => u.brand_id === selectedBrandId)
          .reduce((sum, u) => sum + (u.mention_count || 0), 0);
        
        const competitorCitations = competitorBrandId
          ? sourceUsagesForSource
              .filter(u => u.brand_id === competitorBrandId)
              .reduce((sum, u) => sum + (u.mention_count || 0), 0)
          : 0;

        return {
          ...source,
          totalCitations,
          brandCitations,
          competitorCitations,
        };
      })
      .filter(s => s.totalCitations > 0) // Only show sources with citations
      .filter(s => 
        s.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
      .sort((a, b) => b.totalCitations - a.totalCitations);
  }, [sources, filteredUsages, selectedBrandId, competitorBrandId, searchQuery]);

  // Calculate GAP opportunities
  const gapOpportunities = useMemo((): GapOpportunity[] => {
    if (!selectedBrandId) return [];

    const competitorBrandIds = competitorBrandId 
      ? [competitorBrandId]
      : brands.filter(b => b.id !== selectedBrandId).map(b => b.id);

    if (competitorBrandIds.length === 0) return [];

    const opportunities: GapOpportunity[] = [];

    sources.forEach(source => {
      const sourceUsagesForSource = filteredUsages.filter(u => u.source_id === source.id);
      
      // Check if brand is present in this source
      const brandPresent = sourceUsagesForSource.some(
        u => u.brand_id === selectedBrandId && (u.mention_count || 0) > 0
      );

      if (brandPresent) return; // Skip if brand is already present

      // Check competitor presence
      const competitorUsages = sourceUsagesForSource.filter(
        u => competitorBrandIds.includes(u.brand_id) && (u.mention_count || 0) > 0
      );

      if (competitorUsages.length === 0) return; // Skip if no competitors

      const totalCompetitorCitations = competitorUsages.reduce(
        (sum, u) => sum + (u.mention_count || 0), 0
      );

      // Only show if competitors have at least 2 citations
      if (totalCompetitorCitations < 2) return;

      const competitorBrandNames = [...new Set(
        competitorUsages
          .map(u => brands.find(b => b.id === u.brand_id)?.name)
          .filter(Boolean) as string[]
      )];

      opportunities.push({
        source,
        competitorCitations: totalCompetitorCitations,
        competitorBrands: competitorBrandNames,
      });
    });

    return opportunities.sort((a, b) => b.competitorCitations - a.competitorCitations);
  }, [sources, filteredUsages, selectedBrandId, competitorBrandId, brands]);

  const getCategoryBadge = (category: string | null) => {
    const cat = CATEGORY_OPTIONS.find(c => c.value === category?.toUpperCase());
    if (!cat) {
      return <Badge variant="outline" className="text-xs">Sconosciuto</Badge>;
    }
    return (
      <Badge variant="outline" className={`text-xs ${cat.color}`}>
        {cat.label}
      </Badge>
    );
  };

  const truncateUrl = (url: string | null, maxLength = 40) => {
    if (!url) return "—";
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Globe className="h-6 w-6 text-creative" />
          <div>
            <h1 className="text-2xl font-serif font-medium">Fonti & GAP Analysis</h1>
            {project && (
              <p className="text-sm text-muted-foreground">Progetto: {project.name}</p>
            )}
          </div>
          <Badge variant="outline" className="ml-auto">Labs</Badge>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-96" />
          </div>
        ) : !project ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nessun progetto trovato. Crea un progetto per analizzare le fonti.
              </p>
            </CardContent>
          </Card>
        ) : brands.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nessun brand configurato. Aggiungi brand per visualizzare l'analisi delle fonti.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Periodo</label>
                    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Ultimi 7 giorni</SelectItem>
                        <SelectItem value="30">Ultimi 30 giorni</SelectItem>
                        <SelectItem value="90">Ultimi 90 giorni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Brand Principale</label>
                    <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Seleziona brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map(brand => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Competitor (opzionale)</label>
                    <Select value={competitorBrandId || "none"} onValueChange={(v) => setCompetitorBrandId(v === "none" ? "" : v)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Tutti i competitor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tutti i competitor</SelectItem>
                        {brands
                          .filter(b => b.id !== selectedBrandId)
                          .map(brand => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Modello AI</label>
                    <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i modelli</SelectItem>
                        {models.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-sm font-medium">Cerca dominio</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="sources" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Fonti ({sourcesWithStats.length})
                </TabsTrigger>
                <TabsTrigger value="gap" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  GAP Analysis ({gapOpportunities.length})
                </TabsTrigger>
              </TabsList>

              {/* Sources Tab */}
              <TabsContent value="sources">
                <Card>
                  <CardContent className="p-0">
                    {sourcesWithStats.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Link2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Nessuna fonte trovata per i filtri selezionati.</p>
                        <p className="text-sm mt-2">
                          Le fonti vengono popolate automaticamente dalle analisi AI.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dominio</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Citazioni Totali</TableHead>
                            <TableHead className="text-right">
                              {brands.find(b => b.id === selectedBrandId)?.name || "Brand"}
                            </TableHead>
                            {competitorBrandId && (
                              <TableHead className="text-right">
                                {brands.find(b => b.id === competitorBrandId)?.name || "Competitor"}
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sourcesWithStats.map(source => (
                            <TableRow key={source.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  {source.domain}
                                </div>
                              </TableCell>
                              <TableCell>
                                {source.full_url ? (
                                  <a
                                    href={source.full_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                                  >
                                    {truncateUrl(source.full_url)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground italic">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {getCategoryBadge(source.category)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {source.totalCitations}
                              </TableCell>
                              <TableCell className="text-right">
                                {source.brandCitations > 0 ? (
                                  <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                    {source.brandCitations}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              {competitorBrandId && (
                                <TableCell className="text-right">
                                  {source.competitorCitations > 0 ? (
                                    <Badge variant="outline" className="bg-red-500/10 text-red-600">
                                      {source.competitorCitations}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* GAP Analysis Tab */}
              <TabsContent value="gap">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Lightbulb className="h-5 w-5 text-amber-500" />
                      Opportunità di Visibilità
                    </CardTitle>
                    <CardDescription>
                      Domini dove il tuo brand non è presente ma i competitor sì
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {gapOpportunities.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground px-6">
                        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Nessuna opportunità GAP trovata.</p>
                        <p className="text-sm mt-2">
                          {sourceUsages.length === 0
                            ? "Esegui delle analisi per popolare i dati delle fonti."
                            : "Il tuo brand è presente in tutte le fonti dove compaiono i competitor."}
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dominio</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Competitor Presenti</TableHead>
                            <TableHead className="text-right">Citazioni Competitor</TableHead>
                            <TableHead>Suggerimento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gapOpportunities.map(opp => (
                            <TableRow key={opp.source.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  {opp.source.domain}
                                </div>
                              </TableCell>
                              <TableCell>
                                {getCategoryBadge(opp.source.category)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {opp.competitorBrands.map(name => (
                                    <Badge key={name} variant="outline" className="text-xs">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="bg-red-500/10 text-red-600">
                                  {opp.competitorCitations}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                  <span>
                                    {opp.source.category?.toUpperCase() === "EDITORIAL"
                                      ? "Opportunità PR / Guest post"
                                      : opp.source.category?.toUpperCase() === "UGC"
                                      ? "Opportunità di engagement / review"
                                      : opp.source.category?.toUpperCase() === "INSTITUTIONAL"
                                      ? "Opportunità partnership istituzionale"
                                      : "Opportunità di contenuto / link building"}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SourcesV2;
