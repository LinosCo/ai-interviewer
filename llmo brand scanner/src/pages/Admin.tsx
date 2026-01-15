import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Users, BarChart3, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnalysisQuery {
  id: string;
  url: string;
  industry: string;
  market: string;
  category: string | null;
  user_email: string | null;
  visibility_score: number | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  created_at: string;
}

interface Stats {
  totalQueries: number;
  totalUsers: number;
  avgScore: number;
  queriesThisWeek: number;
  queriesThisMonth: number;
}

const Admin = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [queries, setQueries] = useState<AnalysisQuery[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalQueries: 0,
    totalUsers: 0,
    avgScore: 0,
    queriesThisWeek: 0,
    queriesThisMonth: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .single();

      if (!roles) {
        toast({
          title: "Accesso negato",
          description: "Non hai i permessi per accedere a questa pagina",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      loadData();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    }
  };

  const loadData = async () => {
    try {
      // Load queries
      const { data: queriesData, error: queriesError } = await supabase
        .from("analysis_queries")
        .select("*")
        .order("created_at", { ascending: false });

      if (queriesError) throw queriesError;

      // Load profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      setQueries(queriesData || []);
      setProfiles(profilesData || []);

      // Calculate stats
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const queriesWithScore = (queriesData || []).filter(q => q.visibility_score !== null);
      const avgScore = queriesWithScore.length > 0
        ? queriesWithScore.reduce((sum, q) => sum + (q.visibility_score || 0), 0) / queriesWithScore.length
        : 0;

      const queriesThisWeek = (queriesData || []).filter(q => new Date(q.created_at) >= oneWeekAgo).length;
      const queriesThisMonth = (queriesData || []).filter(q => new Date(q.created_at) >= oneMonthAgo).length;

      setStats({
        totalQueries: queriesData?.length || 0,
        totalUsers: profilesData?.length || 0,
        avgScore: Math.round(avgScore),
        queriesThisWeek,
        queriesThisMonth,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 container mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-serif font-medium mb-3">Dashboard Admin</h1>
          <p className="text-lg text-muted-foreground">Panoramica della piattaforma</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Utenti Registrati</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Query Totali</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalQueries}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Query Questa Settimana</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.queriesThisWeek}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.queriesThisMonth} questo mese
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Score Medio</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgScore}/100</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="queries" className="space-y-6">
          <TabsList>
            <TabsTrigger value="queries">Query Analisi</TabsTrigger>
            <TabsTrigger value="users">Utenti Registrati</TabsTrigger>
          </TabsList>

          <TabsContent value="queries">
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Settore</TableHead>
                    <TableHead>Mercato</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((query) => (
                    <TableRow key={query.id}>
                      <TableCell className="text-sm">
                        {new Date(query.created_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <a
                          href={query.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <span className="truncate max-w-xs">{query.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>{query.industry}</TableCell>
                      <TableCell>{query.market}</TableCell>
                      <TableCell>
                        {query.user_email || (
                          <span className="text-muted-foreground italic">Non registrato</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {query.visibility_score !== null ? (
                          <span className="font-semibold">{query.visibility_score}/100</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {queries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nessuna query ancora
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Registrazione</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID Utente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="text-sm">
                        {new Date(profile.created_at).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{profile.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {profile.id.slice(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                  {profiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Nessun utente registrato
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;
