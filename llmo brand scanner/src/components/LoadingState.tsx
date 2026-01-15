import { useEffect, useState } from "react";
import { Loader2, Check, Clock } from "lucide-react";

  const platforms = [
    { name: "ChatGPT", delay: 0 },
    { name: "Claude", delay: 2000 },
    { name: "Gemini", delay: 4000 },
  ];

const LoadingState = () => {
  const [completedPlatforms, setCompletedPlatforms] = useState<string[]>([]);
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);

  useEffect(() => {
    platforms.forEach((platform) => {
      // Start testing
      setTimeout(() => {
        setTestingPlatform(platform.name);
      }, platform.delay);

      // Complete testing
      setTimeout(() => {
        setCompletedPlatforms((prev) => [...prev, platform.name]);
        setTestingPlatform(null);
      }, platform.delay + 1500);
    });
  }, []);

  const getStatus = (platformName: string) => {
    if (completedPlatforms.includes(platformName)) return "done";
    if (testingPlatform === platformName) return "testing";
    return "waiting";
  };

  const getStatusIcon = (platformName: string) => {
    const status = getStatus(platformName);
    if (status === "done") return <Check className="w-5 h-5 text-success" />;
    if (status === "testing") return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <div className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto text-center">
        {/* Main Spinner */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-muted rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>

        {/* Main Text */}
        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          Analisi in corso...
        </h2>
        <p className="text-base md:text-lg text-muted-foreground mb-12">
          Simuliamo ricerche reali sui principali modelli AI per verificare se raccomandano il tuo brand, prodotto o servizio
        </p>

        {/* Platform Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((platform) => {
            const status = getStatus(platform.name);
            return (
              <div
                key={platform.name}
                className={`
                  p-6 rounded-xl border-2 transition-all duration-300
                  ${status === "waiting" ? "bg-muted/30 border-muted" : ""}
                  ${status === "testing" ? "bg-primary/5 border-primary shadow-lg scale-105" : ""}
                  ${status === "done" ? "bg-success-light border-success" : ""}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`
                    text-sm font-medium
                    ${status === "waiting" ? "text-muted-foreground" : ""}
                    ${status === "testing" ? "text-primary" : ""}
                    ${status === "done" ? "text-success" : ""}
                  `}>
                    {platform.name}
                  </span>
                  {getStatusIcon(platform.name)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {status === "waiting" && "In attesa..."}
                  {status === "testing" && "Test in corso..."}
                  {status === "done" && "Completato"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
