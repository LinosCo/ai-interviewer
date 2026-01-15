import { ExternalLink, Check } from "lucide-react";

const UrlExamples = () => {
  const examples = [
    {
      type: "✓ Corretto",
      url: "https://www.esempio.com/prodotto",
      color: "text-success",
      bg: "bg-success-light",
    },
    {
      type: "✓ Corretto",
      url: "https://shop.esempio.it/categoria/articolo",
      color: "text-success",
      bg: "bg-success-light",
    },
    {
      type: "✗ Da evitare",
      url: "esempio.com (manca https://)",
      color: "text-error",
      bg: "bg-error-light",
    },
    {
      type: "⚠ Meglio pulire",
      url: "...?utm_source=fb&fbclid=xyz",
      color: "text-warning",
      bg: "bg-warning-light",
    },
  ];

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <ExternalLink className="w-4 h-4 text-creative" />
        Esempi di URL
      </h4>
      <div className="space-y-2">
        {examples.map((example, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 p-2 rounded ${example.bg}`}
          >
            <span className={`text-xs font-medium ${example.color} flex-shrink-0`}>
              {example.type}
            </span>
            <code className="text-xs text-muted-foreground flex-1 break-all">
              {example.url}
            </code>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        💡 Il sistema pulirà automaticamente parametri di tracciamento superflui
      </p>
    </div>
  );
};

export default UrlExamples;
