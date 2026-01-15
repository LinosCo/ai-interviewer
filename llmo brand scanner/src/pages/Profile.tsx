import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Results from "@/components/Results";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Calendar, Globe, Building } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AnalysisQuery {
  id: string;
  url: string;
  industry: string;
  market: string;
  category: string | null;
  brand_name: string | null;
  product_name: string | null;
  visibility_score: number | null;
  results: any;
  created_at: string;
}

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchAnalyses();
    }
  }, [user]);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("analysis_queries")
        .select("*")
        .or(`user_id.eq.${user?.id},user_email.eq.${user?.email}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error("Error fetching analyses:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-success";
    if (score >= 60) return "bg-warning";
    return "bg-error";
  };

  const getRatingText = (score: number | null) => {
    if (!score) return "N/A";
    if (score >= 80) return "Eccellente";
    if (score >= 60) return "Buono";
    if (score >= 40) return "Sufficiente";
    return "Da Migliorare";
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h1 className="font-serif text-4xl md:text-5xl font-medium mb-3">
              Le Mie Analisi
            </h1>
            <p className="text-lg text-muted-foreground">
              Storico completo delle tue ricerche e risultati
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-6 text-muted-foreground">Caricamento analisi...</p>
            </div>
          ) : analyses.length === 0 ? (
            <Card className="p-16 text-center rounded-xl">
              <p className="text-muted-foreground mb-6">Non hai ancora effettuato analisi</p>
              <Button onClick={() => navigate("/")}>
                Inizia la tua prima analisi
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {analyses.map((analysis) => {
                // Parse results if they're a string and enrich with fallback data
                const rawResults = typeof analysis.results === 'string'
                  ? JSON.parse(analysis.results)
                  : analysis.results || {};

                const completeResults = {
                  ...rawResults,
                  siteInfo: rawResults.siteInfo ?? {
                    url: analysis.url,
                    title: analysis.url,
                    brandName: analysis.brand_name || undefined,
                    productName: analysis.product_name || undefined,
                  },
                  visibilityScore: typeof rawResults.visibilityScore === 'number'
                    ? rawResults.visibilityScore
                    : analysis.visibility_score || 0,
                };

                return (
                  <Card key={analysis.id} className="overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <a
                            href={analysis.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lg font-medium hover:underline"
                          >
                            {analysis.url}
                          </a>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(analysis.created_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Building className="h-4 w-4" />
                            {analysis.industry}
                          </div>
                          <Badge variant="outline">{analysis.market}</Badge>
                          {analysis.category && (
                            <Badge variant="secondary">{analysis.category}</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${getRatingColor(analysis.visibility_score)} bg-clip-text text-transparent`}>
                            {analysis.visibility_score || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {getRatingText(analysis.visibility_score)}
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpand(analysis.id)}
                        >
                          {expandedId === analysis.id ? (
                            <>
                              Nascondi <ChevronUp className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Dettagli <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                    {expandedId === analysis.id && completeResults && (
                      <div className="border-t border-border p-6 bg-muted/30">
                        <Results
                          data={completeResults}
                          onNewTest={() => navigate("/")}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
