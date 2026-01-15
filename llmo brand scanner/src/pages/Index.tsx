import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import AnalysisForm, { FormData } from "@/components/AnalysisForm";
import AnalysisProgress, { AnalysisStep } from "@/components/AnalysisProgress";
import Results from "@/components/Results";
import PartialResults from "@/components/PartialResults";
import UpgradeOffer from "@/components/UpgradeOffer";
import HowItWorks from "@/components/HowItWorks";
import Footer from "@/components/Footer";

// Generate or retrieve session ID for guest users
const getGuestSessionId = () => {
  let sessionId = localStorage.getItem('guest_session_id');
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('guest_session_id', sessionId);
  }
  return sessionId;
};

// Mock data for demonstration
const mockResults = {
  siteInfo: {
    url: "https://www.esempio.it",
    title: "Esempio S.r.l. - Software Gestionale",
    favicon: undefined,
  },
  visibilityScore: 65,
  technicalChecks: [
    {
      name: "Schema.org Markup",
      description: "Presenza di markup strutturato per migliorare la comprensione da parte degli AI",
      status: "pass" as const,
      score: 10,
    },
    {
      name: "JSON-LD Implementation",
      description: "Implementazione corretta di dati strutturati in formato JSON-LD",
      status: "pass" as const,
      score: 10,
    },
    {
      name: "Organization Schema",
      description: "Schema Organization per identificare chiaramente l'azienda",
      status: "warning" as const,
      score: 5,
    },
    {
      name: "Meta Description",
      description: "Tag meta description ottimizzato e descrittivo",
      status: "pass" as const,
      score: 10,
    },
    {
      name: "Open Graph Tags",
      description: "Tag Open Graph per la condivisione social",
      status: "fail" as const,
      score: 0,
    },
  ],
  platformResults: [
    {
      name: "ChatGPT",
      query: "Quali sono i migliori software gestionali in Italia?",
      response: "Per software gestionali in Italia, ti consiglio di considerare:\n\n1. TeamSystem - Leader italiano per PMI\n2. SAP Business One - Soluzione enterprise\n3. Zucchetti - Molto diffuso nelle medie imprese\n4. Microsoft Dynamics - Opzione cloud scalabile\n5. Odoo - Open source e personalizzabile",
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: "Il brand non è stato menzionato tra le raccomandazioni principali. Questo indica una bassa visibilità nelle risposte di ChatGPT.",
    },
    {
      name: "Claude",
      query: "Mi serve un software gestionale affidabile per la mia azienda in Italia",
      response: "Per un software gestionale affidabile in Italia, ti suggerisco di valutare:\n\n• TeamSystem - ottimo supporto locale\n• SAP Business One - per esigenze enterprise\n• Zucchetti - molto usato dalle PMI italiane\n• Esempio S.r.l. - interessante per funzionalità moderne\n\nConsiglio di richiedere demo gratuite per valutare quale si adatta meglio.",
      mentioned: true,
      partial: false,
      confidence: 0.8,
      analysis: "Ottimo! Il brand è stato menzionato tra le opzioni consigliate, anche se non in prima posizione.",
    },
    {
      name: "Gemini",
      query: "Confronta i migliori software gestionali disponibili in Italia",
      response: "Ecco un confronto dei principali software gestionali in Italia:\n\n**TeamSystem**: Molto diffuso, ottimo supporto locale, prezzi medi\n**SAP Business One**: Enterprise-grade, completo ma costoso\n**Zucchetti**: Buon rapporto qualità-prezzo, moduli specifici\n**Microsoft Dynamics**: Cloud-first, integrato con Office 365\n\nLa scelta dipende dalle dimensioni dell'azienda e dal budget.",
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: "Il brand non appare nei risultati. Google Gemini si concentra sui player più consolidati.",
    },
    {
      name: "Perplexity",
      query: "Quali aziende offrono software gestionali in Italia?",
      response: "Le principali aziende che offrono software gestionali in Italia sono:\n\n1. **TeamSystem** - leader di mercato con oltre 100 soluzioni\n2. **Zucchetti** - presente da oltre 40 anni\n3. **SAP Italia** - per grandi aziende\n4. **Microsoft** - con Dynamics 365\n5. **Wolters Kluwer** - specializzato in professionisti\n\nCi sono anche soluzioni più piccole e specializzate come Esempio, che si concentrano su nicchie specifiche.",
      mentioned: true,
      partial: true,
      confidence: 0.4,
      analysis: "Il brand è stato menzionato ma in modo marginale, come 'soluzione più piccola'. Visibilità parziale.",
    },
    {
      name: "Copilot",
      query: "Best gestionale software companies in Italy",
      response: "The best management software companies operating in Italy include:\n\n• TeamSystem - Italian market leader\n• SAP - Enterprise solutions\n• Zucchetti - Established Italian provider\n• Microsoft Dynamics - Cloud-based platform\n• Oracle NetSuite - International option\n\nThese companies offer comprehensive ERP solutions for Italian businesses.",
      mentioned: false,
      partial: false,
      confidence: 0,
      analysis: "Nessuna menzione. Copilot si focalizza sui brand internazionali e leader di mercato.",
    },
  ],
  recommendations: [
    {
      priority: "critical" as const,
      title: "Implementa Schema.org Organization completo",
      description: "Aggiungi markup strutturato completo con informazioni su nome azienda, settore, prodotti, recensioni e contatti. Gli AI utilizzano questi dati strutturati per identificare e comprendere la tua azienda. Includi: nome legale, logo, descrizione, area geografica servita, prodotti/servizi offerti.",
      impact: "Impatto: +15 punti | Tempo: 2-3 ore",
    },
    {
      priority: "high" as const,
      title: "Crea contenuti che rispondano a domande specifiche",
      description: "Pubblica articoli e guide che rispondano alle domande più comuni nel tuo settore (es: 'Come scegliere un software gestionale', 'Quali caratteristiche deve avere un ERP moderno'). Usa un formato domanda-risposta chiaro. Gli AI privilegiano contenuti che forniscono risposte dirette e autorevoli.",
      impact: "Impatto: +20 punti | Tempo: 8-10 ore",
    },
    {
      priority: "high" as const,
      title: "Ottimizza le recensioni e i casi studio",
      description: "Raccogli e pubblica recensioni dettagliate da clienti reali con dati concreti (es: 'ridotto i tempi del 40%'). Crea casi studio approfonditi che descrivano problemi, soluzione e risultati. Gli AI citano spesso brand con prove sociali forti e risultati misurabili.",
      impact: "Impatto: +12 punti | Tempo: 5-6 ore",
    },
    {
      priority: "medium" as const,
      title: "Aumenta la presenza su fonti autorevoli",
      description: "Lavora per essere citato su: blog di settore, directory specializzate, confronti di software, forum professionali. Partecipa attivamente a conversazioni online nel tuo settore. Gli AI danno più peso ai brand menzionati da fonti terze affidabili.",
      impact: "Impatto: +18 punti | Tempo: continuativo",
    },
  ],
};

const Index = () => {
  const [state, setState] = useState<"initial" | "loading" | "partial" | "results" | "limit-reached">("initial");
  const [resultsData, setResultsData] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [availableQueries, setAvailableQueries] = useState<number>(5);
  const [queriesUsed, setQueriesUsed] = useState<number>(0);
  const [analysisKey, setAnalysisKey] = useState(0);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<AnalysisStep>("loading-page");
  const requestIdRef = useRef(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadQueryLimits();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        // Associate guest analyses with newly registered user
        const guestSessionId = localStorage.getItem('guest_session_id');
        if (guestSessionId) {
          try {
            await supabase.rpc('associate_session_analyses', {
              _user_id: session.user.id,
              _session_id: guestSessionId
            });
            // Clear the guest session after association
            localStorage.removeItem('guest_session_id');
            console.log('Guest analyses associated with user account');
          } catch (error) {
            console.error('Error associating guest analyses:', error);
          }
        }
        loadQueryLimits();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
  };

  const loadQueryLimits = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      const isAdmin = roleData?.role === 'admin';
      if (isAdmin) {
        setAvailableQueries(999999); // Unlimited for admins
        return;
      }

      // Get available queries using the database function
      const { data, error } = await supabase.rpc('get_user_available_queries', {
        user_id_param: session.user.id
      });

      if (error) throw error;

      setAvailableQueries(data || 0);

      // Count used queries
      const { count } = await supabase
        .from('analysis_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      setQueriesUsed(count || 0);
    } catch (error) {
      console.error('Error loading query limits:', error);
    }
  };

  const handleFormSubmit = async (formData: FormData & { userEmail?: string }) => {
    setResultsData(null); // Clear previous results
    setAnalysisKey((k) => k + 1);
    setCurrentAnalysisStep("loading-page"); // Reset to first step
    const reqId = requestIdRef.current + 1;
    requestIdRef.current = reqId;
    setState("loading");

    // Simulate progress through steps
    const progressSteps: AnalysisStep[] = [
      "loading-page",
      "technical-analysis", 
      "chatgpt-test",
      "claude-test",
      "gemini-test",
      "generating-report"
    ];

    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < progressSteps.length) {
        setCurrentAnalysisStep(progressSteps[stepIndex]);
      } else {
        clearInterval(stepInterval);
      }
    }, 8000); // Change step every 8 seconds

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check query limit for authenticated users before making the request
      if (session?.user?.id) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .single();

        const isAdmin = roleData?.role === 'admin';

        if (!isAdmin) {
          // Check available queries
          const { data: availableQueriesData, error: queriesError } = await supabase.rpc('get_user_available_queries', {
            user_id_param: session.user.id
          });

          if (queriesError) throw queriesError;

          if (availableQueriesData <= 0) {
            setState("limit-reached");
            return;
          }
        }
      }

      // Set user email if authenticated
      const userEmail = session?.user?.email || null;
      const guestSessionId = !session ? getGuestSessionId() : null;
      
      const { data, error } = await supabase.functions.invoke("analyze-url", {
        body: {
          url: formData.url,
          market: formData.market,
          category: formData.category || undefined,
          userId: session?.user?.id,
          userEmail: userEmail,
          sessionId: guestSessionId,
        },
      });

      if (error) throw error;

      console.log("Analysis data received:", data);
      
      // Ignore stale responses if a newer analysis started
      if (requestIdRef.current !== reqId) {
        console.warn("Stale analysis result ignored");
        return;
      }
      
      // Validate data structure before setting state
      if (!data || !data.siteInfo || !data.visibilityScore) {
        throw new Error("Dati dell'analisi incompleti");
      }

      // Clear the step progression interval
      clearInterval(stepInterval);
      setCurrentAnalysisStep("complete");

      setResultsData(data);
      
      // Send analysis notification email if user is authenticated
      if (session?.user?.email) {
        supabase.functions.invoke("send-analysis-notification", {
          body: {
            email: session.user.email,
            url: formData.url,
            visibilityScore: data.visibilityScore,
            brandName: data.siteInfo?.brand || data.brandName,
            productName: data.siteInfo?.product || data.productName,
          },
        }).catch(err => console.error("Error sending analysis notification:", err));
      }
      
      if (isAuthenticated) {
        setState("results");
        toast({
          title: "Analisi completata",
          description: "I risultati sono pronti!",
        });
      } else {
        setState("partial");
        toast({
          title: "Anteprima risultati",
          description: "Registrati per vedere il report completo!",
        });
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      clearInterval(stepInterval);
      setState("initial");
      
      // Handle specific error codes
      if (error.message?.includes('LIMIT_REACHED')) {
        toast({
          title: "Limite raggiunto",
          description: "Hai raggiunto il limite di 5 analisi. Contatta il supporto per aumentare il limite.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: error.message || "Si è verificato un errore durante l'analisi.",
          variant: "destructive",
        });
      }
    }
  };

  const handleNewTest = () => {
    setResultsData(null);
    setState("initial");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSignup = () => {
    navigate("/auth");
  };

  const handleUpgrade = async () => {
    toast({
      title: "Pagamento in configurazione",
      description: "Il sistema di pagamento Stripe sarà disponibile a breve. Contatta il supporto per procedere all'acquisto.",
    });
    
    // TODO: Implement Stripe checkout
    // When Stripe is configured, this will create a checkout session
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {state !== "results" && state !== "partial" && (
        <Hero />
      )}
      
      {state === "initial" && (
        <>
          <AnalysisForm onSubmit={handleFormSubmit} />
          <HowItWorks />
        </>
      )}
      
      {state === "loading" && <AnalysisProgress key={analysisKey} currentStep={currentAnalysisStep} />}

      {state === "partial" && resultsData && (
        <PartialResults key={analysisKey} data={resultsData} onSignup={handleSignup} />
      )}

      {state === "limit-reached" && (
        <UpgradeOffer queriesUsed={queriesUsed} onUpgrade={handleUpgrade} />
      )}
      
      {state === "results" && resultsData && <Results key={analysisKey} data={resultsData} onNewTest={handleNewTest} />}
      
      <Footer />
    </div>
  );
};

export default Index;
