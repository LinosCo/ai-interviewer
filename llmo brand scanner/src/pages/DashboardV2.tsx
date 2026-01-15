import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, TrendingUp, TrendingDown, Minus, FlaskConical, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
interface Brand {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  website_url: string | null;
}

interface VisibilityMetric {
  id: string;
  brand_id: string;
  model_id: string;
  visibility_score: number | null;
  sentiment_score: number | null;
  avg_position: number | null;
  period_start: string;
  period_end: string;
}

interface AIModel {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
}

interface UserProject {
  id: string;
  name: string;
}

type PeriodFilter = "7" | "30";

const DashboardV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<UserProject | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [metrics, setMetrics] = useState<VisibilityMetric[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  
  // Filters
  const [period, setPeriod] = useState<PeriodFilter>("7");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create project dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
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
        .select("id, name, description, industry, website_url")
        .eq("project_id", projectData.id);
      
      setBrands(brandsData || []);
      if (brandsData && brandsData.length > 0) {
        setSelectedBrandId(brandsData[0].id);
      }

      // Fetch all active AI models
      const { data: modelsData } = await supabase
        .from("ai_models")
        .select("id, name, display_name, is_active")
        .eq("is_active", true);
      
      setModels(modelsData || []);

      // Fetch visibility metrics for all brands in this project
      if (brandsData && brandsData.length > 0) {
        const brandIds = brandsData.map(b => b.id);
        const { data: metricsData } = await supabase
          .from("visibility_metrics")
          .select("id, brand_id, model_id, visibility_score, sentiment_score, avg_position, period_start, period_end")
          .in("brand_id", brandIds);
        
        setMetrics(metricsData || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!user || !newProjectName.trim()) return;
    
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("user_projects")
        .insert({
          user_id: user.id,
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Progetto creato",
        description: `Il progetto "${data.name}" è stato creato con successo.`,
      });
      
      setShowCreateDialog(false);
      setNewProjectName("");
      setNewProjectDescription("");
      setProject(data);
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare il progetto. Riprova.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Filter brands by search query
  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get metrics for a specific brand within the selected period and model
  const getBrandMetrics = (brandId: string) => {
    const now = new Date();
    const periodDays = parseInt(period);
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split("T")[0];
    
    return metrics.filter(m => {
      // Compare dates as strings (YYYY-MM-DD format) to avoid timezone issues
      const matchesPeriod = m.period_end >= startDateStr;
      const matchesModel = selectedModel === "all" || m.model_id === selectedModel;
      return m.brand_id === brandId && matchesPeriod && matchesModel;
    });
  };

  // Calculate average visibility for a brand
  const getAverageVisibility = (brandId: string): number | null => {
    const brandMetrics = getBrandMetrics(brandId);
    if (brandMetrics.length === 0) return null;
    
    const validScores = brandMetrics.filter(m => m.visibility_score !== null);
    if (validScores.length === 0) return null;
    
    const sum = validScores.reduce((acc, m) => acc + (m.visibility_score || 0), 0);
    return Math.round(sum / validScores.length);
  };

  // Get sentiment label
  const getSentiment = (brandId: string): "positivo" | "neutro" | "negativo" | null => {
    const brandMetrics = getBrandMetrics(brandId);
    if (brandMetrics.length === 0) return null;
    
    const validSentiments = brandMetrics.filter(m => m.sentiment_score !== null);
    if (validSentiments.length === 0) return null;
    
    const avgSentiment = validSentiments.reduce((acc, m) => acc + (m.sentiment_score || 0), 0) / validSentiments.length;
    
    if (avgSentiment >= 0.3) return "positivo";
    if (avgSentiment <= -0.3) return "negativo";
    return "neutro";
  };

  // Get position label
  const getPosition = (brandId: string): "TOP" | "MENZIONATO" | "ASSENTE" | null => {
    const brandMetrics = getBrandMetrics(brandId);
    if (brandMetrics.length === 0) return null;
    
    const validPositions = brandMetrics.filter(m => m.avg_position !== null);
    if (validPositions.length === 0) return null;
    
    const avgPosition = validPositions.reduce((acc, m) => acc + (m.avg_position || 0), 0) / validPositions.length;
    
    if (avgPosition <= 1) return "TOP";
    if (avgPosition <= 5) return "MENZIONATO";
    return "ASSENTE";
  };

  // Get chart data for selected brand
  const getChartData = () => {
    if (!selectedBrandId) return [];
    
    const brandMetrics = getBrandMetrics(selectedBrandId)
      .filter(m => m.visibility_score !== null)
      .sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime());
    
    return brandMetrics.map(m => ({
      date: new Date(m.period_start).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      visibility: m.visibility_score || 0,
    }));
  };

  const getSentimentIcon = (sentiment: "positivo" | "neutro" | "negativo" | null) => {
    switch (sentiment) {
      case "positivo": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "negativo": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "neutro": return <Minus className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getPositionBadgeVariant = (position: "TOP" | "MENZIONATO" | "ASSENTE" | null) => {
    switch (position) {
      case "TOP": return "default";
      case "MENZIONATO": return "secondary";
      case "ASSENTE": return "outline";
      default: return "outline";
    }
  };

  const chartData = getChartData();
  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <FlaskConical className="h-6 w-6 text-creative" />
          <div>
            <h1 className="text-2xl font-serif font-medium">Dashboard V2</h1>
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
              <Skeleton className="h-10 flex-1" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          </div>
        ) : !project ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-muted-foreground">
                Nessun progetto trovato. Crea un progetto per iniziare a monitorare i tuoi brand.
              </p>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Crea progetto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nuovo progetto</DialogTitle>
                    <DialogDescription>
                      Crea un progetto per organizzare i tuoi brand e le analisi di visibilità AI.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Nome progetto *</Label>
                      <Input
                        id="project-name"
                        placeholder="Es. Il mio brand principale"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Descrizione (opzionale)</Label>
                      <Textarea
                        id="project-description"
                        placeholder="Breve descrizione del progetto..."
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Annulla
                    </Button>
                    <Button 
                      onClick={handleCreateProject} 
                      disabled={!newProjectName.trim() || creating}
                    >
                      {creating ? "Creazione..." : "Crea progetto"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        ) : brands.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nessun brand configurato per questo progetto. Aggiungi brand per visualizzare le metriche.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Ultimi 7 giorni</SelectItem>
                  <SelectItem value="30">Ultimi 30 giorni</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Modello AI" />
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

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Brands Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {filteredBrands.map(brand => {
                const visibility = getAverageVisibility(brand.id);
                const sentiment = getSentiment(brand.id);
                const position = getPosition(brand.id);
                const isSelected = selectedBrandId === brand.id;

                return (
                  <Card 
                    key={brand.id} 
                    className={`cursor-pointer transition-all hover:border-creative/50 ${isSelected ? 'border-creative ring-1 ring-creative/20' : ''}`}
                    onClick={() => setSelectedBrandId(brand.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-medium flex items-center justify-between">
                        {brand.name}
                        {position && (
                          <Badge variant={getPositionBadgeVariant(position)}>
                            {position}
                          </Badge>
                        )}
                      </CardTitle>
                      {brand.industry && (
                        <p className="text-xs text-muted-foreground">{brand.industry}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Visibilità</p>
                          {visibility !== null ? (
                            <p className="text-2xl font-semibold">{visibility}%</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Nessun dato</p>
                          )}
                        </div>
                        {sentiment && (
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(sentiment)}
                            <span className="text-sm capitalize">{sentiment}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Trend Chart */}
            {selectedBrand && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Trend Visibilità: {selectedBrand.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="visibility" 
                            stroke="hsl(var(--creative))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--creative))' }}
                            name="Visibilità %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      <p>Nessun dato disponibile per il periodo selezionato</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default DashboardV2;
