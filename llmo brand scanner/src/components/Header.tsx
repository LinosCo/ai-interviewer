import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { LogOut, User, UserCircle, Sparkles, FlaskConical, MessageSquare, Globe } from "lucide-react";

const Header = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card border-b border-border backdrop-blur-sm bg-card/95">
      <div className="container mx-auto px-6 h-[73px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
          <div className="relative">
            <span className="font-serif text-2xl font-medium italic">Lino's</span>
            <span className="font-serif text-2xl font-light ml-1">&</span>
            <span className="font-serif text-2xl font-normal ml-1">co</span>
            <Sparkles className="w-3 h-3 text-creative absolute -top-1 -right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </a>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard-v2")}
                className="gap-2 hover:text-creative"
              >
                <FlaskConical className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/prompts-v2")}
                className="gap-2 hover:text-creative"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Prompts</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/sources-v2")}
                className="gap-2 hover:text-creative"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Fonti</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/profile")}
                className="gap-2 hover:text-creative"
              >
                <UserCircle className="h-4 w-4" />
                Profilo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2 hover:border-creative"
              >
                <LogOut className="h-4 w-4" />
                Esci
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/auth")}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <User className="h-4 w-4" />
              Accedi
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
