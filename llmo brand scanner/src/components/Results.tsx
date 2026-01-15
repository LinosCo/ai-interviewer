import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AnalysisIntroduction } from "./AnalysisIntroduction";
import { VisibilityScoreCard } from "./VisibilityScoreCard";
import { LLMInsightsSection } from "./LLMInsightsSection";
import { ExtractedInfoCard } from "./ExtractedInfoCard";
import { ProductAnalysisVisual } from "./ProductAnalysisVisual";
import { NeedBasedPromptsSection } from "./NeedBasedPromptsSection";
import { TechnicalChecksGrouped } from "./TechnicalChecksGrouped";
import { ImprovementRoadmap } from "./ImprovementRoadmap";
import { DynamicCTASection } from "./DynamicCTASection";
import { calculateScoreContributions, calculateImprovementSuggestion, calculateBenchmark } from "@/utils/scoreCalculations";

interface ResultsProps {
  data: {
    siteInfo: {
      url: string;
      title: string;
      favicon?: string;
      brandName?: string;
      productName?: string;
    };
    visibilityScore: number;
    technicalChecks: Array<{
      name: string;
      description: string;
      status: "pass" | "warning" | "fail";
      score: number;
    }>;
    platformResults: Array<{
      name: string;
      query: string;
      response: string;
      mentioned: boolean;
      partial: boolean;
      confidence: number;
      analysis: string;
    }>;
    comingSoonPlatforms?: string[];
    productAnalysis?: {
      mainFunction: string;
      needs: { primary: string[], secondary: string[] };
      contexts: string[];
      clusters: string[];
      queries: string[];
    };
    recommendations: Array<{
      priority: "critical" | "high" | "medium";
      title: string;
      description: string;
      impact: string;
    }>;
  };
  onNewTest: () => void;
}

const Results = ({ data, onNewTest }: ResultsProps) => {
  const { isAdmin } = useIsAdmin();
  
  // Add safety checks for data
  if (!data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="bg-error/10 border border-error rounded-lg p-6 text-center">
          <p className="text-error">Errore nel caricamento dei risultati. Dati mancanti.</p>
          <Button onClick={onNewTest} className="mt-4">Nuova Analisi</Button>
        </div>
      </div>
    );
  }
  
  const getRating = (score: number) => {
    if (score >= 80) return { text: "Eccellente", color: "text-success" };
    if (score >= 60) return { text: "Buono", color: "text-success" };
    if (score >= 40) return { text: "Discreto", color: "text-warning" };
    return { text: "Critico", color: "text-error" };
  };

  const rating = getRating(data.visibilityScore);

  // Calculate score contributions and improvement suggestions
  const scoreContributions = calculateScoreContributions(
    data.technicalChecks || [],
    data.platformResults || [],
    data.productAnalysis
  );

  const improvementSuggestion = calculateImprovementSuggestion(
    data.technicalChecks || [],
    data.platformResults || []
  );

  const benchmark = calculateBenchmark(data.visibilityScore || 0);

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    let yPos = 0;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Premium color palette
    const colors = {
      black: [26, 26, 26],
      charcoal: [51, 51, 51],
      gray: [102, 102, 102],
      lightGray: [200, 200, 200],
      offWhite: [250, 250, 250],
      gold: [255, 193, 7],
      amber: [255, 152, 0],
      success: [76, 175, 80],
      warning: [255, 152, 0],
      error: [244, 67, 54],
      creative: [255, 107, 53]
    };

    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - 30) {
        doc.addPage();
        yPos = 25;
        return true;
      }
      return false;
    };

    const drawDecorativeLine = (y: number, color: number[] = colors.gold) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 40, y);
    };

    const drawGauge = (x: number, y: number, score: number, size: number = 40) => {
      const radius = size / 2;
      const centerX = x + radius;
      const centerY = y + radius;
      
      doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
      doc.setLineWidth(4);
      for (let angle = 180; angle <= 360; angle += 5) {
        const rad = (angle * Math.PI) / 180;
        const x1 = centerX + (radius - 2) * Math.cos(rad);
        const y1 = centerY + (radius - 2) * Math.sin(rad);
        doc.circle(x1, y1, 0.5, 'F');
      }
      
      const scoreColor = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.error;
      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      const maxAngle = 180 + (score / 100) * 180;
      for (let angle = 180; angle <= maxAngle; angle += 5) {
        const rad = (angle * Math.PI) / 180;
        const x1 = centerX + (radius - 2) * Math.cos(rad);
        const y1 = centerY + (radius - 2) * Math.sin(rad);
        doc.circle(x1, y1, 0.8, 'F');
      }
      
      doc.setFillColor(255, 255, 255);
      doc.circle(centerX, centerY, radius - 8, 'F');
      
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(`${Math.round(score)}`, centerX, centerY + 2, { align: "center" });
    };

    // Cover Page
    doc.setFillColor(26, 26, 26);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setFillColor(255, 215, 100);
    doc.circle(pageWidth - 40, 60, 80, 'F');
    doc.circle(20, pageHeight - 40, 60, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("times", "bold");
    yPos = 80;
    doc.text("AI Visibility Analysis Report", pageWidth / 2, yPos, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("times", "italic");
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    yPos += 12;
    doc.text("2025 Edition", pageWidth / 2, yPos, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    yPos += 20;
    const missionLines = doc.splitTextToSize("Come gli assistenti AI percepiscono il tuo brand e il tuo prodotto", contentWidth - 40);
    doc.text(missionLines, pageWidth / 2, yPos, { align: "center" });

    yPos += 25;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 20, yPos, contentWidth - 40, 25, 3, 3, 'F');
    
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(8);
    doc.text("URL ANALIZZATO", pageWidth / 2, yPos + 8, { align: "center" });
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const urlText = data.siteInfo.url.length > 60 ? data.siteInfo.url.substring(0, 60) + "..." : data.siteInfo.url;
    doc.text(urlText, pageWidth / 2, yPos + 17, { align: "center" });

    yPos = pageHeight - 80;
    doc.setFontSize(24);
    doc.setFont("times", "italic");
    doc.setTextColor(255, 255, 255);
    doc.text("Lino's", pageWidth / 2 - 15, yPos, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(18);
    doc.text("&", pageWidth / 2, yPos);
    doc.setFont("times", "italic");
    doc.setFontSize(24);
    doc.text("co", pageWidth / 2 + 12, yPos);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    const date = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(date, pageWidth / 2, pageHeight - 40, { align: "center" });

    // Executive Summary with Gauge
    doc.addPage();
    yPos = 25;

    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(22);
    doc.setFont("times", "bold");
    doc.text("Executive Summary", margin, yPos);
    drawDecorativeLine(yPos + 3);
    yPos += 18;

    const score = data.visibilityScore || 0;
    const scoreLevel = score >= 80 ? "ECCELLENTE" : score >= 65 ? "BUONO" : score >= 50 ? "DISCRETO" : score >= 35 ? "BASSO" : "CRITICO";
    const scoreColor = score >= 80 ? colors.success : score >= 65 ? [100, 181, 246] : score >= 50 ? colors.warning : score >= 35 ? colors.amber : colors.error;

    drawGauge(margin, yPos, score, 50);

    const scoreStartX = margin + 60;
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PUNTEGGIO VISIBILITÀ AI", scoreStartX, yPos + 8);
    
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(`${Math.round(score)}`, scoreStartX, yPos + 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(scoreLevel, scoreStartX + 25, yPos + 22);

    yPos += 35;
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const contextMsg = score < 35 ? "Il tuo brand non è attualmente riconosciuto da nessun assistente AI." :
                       score < 50 ? "Il tuo brand ha una visibilità limitata. C'è ampio margine di miglioramento." :
                       score < 65 ? "Il tuo brand è parzialmente visibile, ma serve ottimizzazione per massimizzare l'impatto." :
                       score < 80 ? "Ottimo lavoro! Il tuo brand è ben posizionato. Pochi miglioramenti per l'eccellenza." :
                       "Eccellente! Il tuo brand è altamente visibile agli assistenti AI.";
    const contextLines = doc.splitTextToSize(contextMsg, contentWidth - 10);
    doc.text(contextLines, margin, yPos);
    yPos += contextLines.length * 5 + 10;

    // Score contributions with micro-comments
    checkPageBreak(80);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Contributi al Punteggio", margin, yPos);
    yPos += 8;

    scoreContributions.forEach((contribution) => {
      checkPageBreak(18);
      
      const barHeight = 12;
      const barWidth = contentWidth - 80;
      doc.setFillColor(colors.offWhite[0], colors.offWhite[1], colors.offWhite[2]);
      doc.roundedRect(margin, yPos, barWidth, barHeight, 2, 2, 'F');
      
      const fillWidth = (contribution.value / contribution.maxValue) * barWidth;
      if (fillWidth > 0) {
        const barColor = contribution.label.includes("Estrazione") ? [66, 165, 245] :
                         contribution.label.includes("LLM") ? colors.creative :
                         contribution.label.includes("tecniche") ? colors.success : [156, 39, 176];
        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.roundedRect(margin, yPos, fillWidth, barHeight, 2, 2, 'F');
      }
      
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(contribution.label, margin + 3, yPos + 8);
      
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
      doc.setFont("helvetica", "bold");
      doc.text(`${contribution.value}/${contribution.maxValue}`, margin + barWidth + 5, yPos + 8);

      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      let microComment = "";
      if (contribution.label.includes("Estrazione") && contribution.value >= 15) microComment = "✓ Perfetta estrazione dati";
      else if (contribution.label.includes("Estrazione") && contribution.value < 10) microComment = "✗ Dati incompleti o bloccati";
      else if (contribution.label.includes("LLM") && contribution.value < 10) microComment = "✗ Gli AI non riconoscono il brand";
      else if (contribution.label.includes("LLM") && contribution.value >= 30) microComment = "✓ Ottima menzione";
      else if (contribution.label.includes("tecniche") && contribution.value < 15) microComment = "⚠ Verifiche non superate";
      else if (contribution.label.includes("tecniche") && contribution.value >= 25) microComment = "✓ Tecnica solida";
      else if (contribution.label.includes("Structured") && contribution.value < 5) microComment = "✗ Mancano dati strutturati";
      else if (contribution.label.includes("Structured") && contribution.value >= 8) microComment = "✓ Struttura ottimale";
      doc.text(microComment, margin + barWidth + 30, yPos + 8);
      
      yPos += 15;
    });

    yPos += 5;
    checkPageBreak(25);
    doc.setFillColor(colors.offWhite[0], colors.offWhite[1], colors.offWhite[2]);
    doc.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F');
    
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("OPPORTUNITÀ DI MERCATO", margin + 5, yPos + 7);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const benchmarkMsg = "La maggior parte dei siti del tuo settore non è ancora ottimizzata per gli AI: hai un'opportunità significativa di posizionarti tra i primi.";
    const benchLines = doc.splitTextToSize(benchmarkMsg, contentWidth - 15);
    doc.text(benchLines, margin + 5, yPos + 13);
    yPos += 25;

    doc.save(`AI-Visibility-Report-Premium-${data.siteInfo.url.replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.pdf`);
  };

  return (
    <div className="container mx-auto px-6 py-16 max-w-6xl animate-fade-in">
      <AnalysisIntroduction />

      <VisibilityScoreCard 
        score={data.visibilityScore}
        contributions={scoreContributions}
        improvementSuggestion={improvementSuggestion}
        benchmark={benchmark}
      />

      <LLMInsightsSection platformResults={data.platformResults || []} />

      <ExtractedInfoCard siteInfo={data.siteInfo} />

      <ProductAnalysisVisual productAnalysis={data.productAnalysis} />

      <NeedBasedPromptsSection 
        queries={data.productAnalysis?.queries || []}
        clusters={data.productAnalysis?.clusters || []}
        platformResults={data.platformResults || []}
      />

      <TechnicalChecksGrouped technicalChecks={data.technicalChecks || []} />

      <ImprovementRoadmap recommendations={data.recommendations || []} />

      <DynamicCTASection 
        score={data.visibilityScore}
        siteUrl={data.siteInfo.url}
        onNewTest={onNewTest}
        onDownloadPDF={handleDownloadPDF}
      />
      
      {isAdmin && (
        <div className="mt-8 p-4 border border-dashed border-muted-foreground/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Admin: Raw data disponibile nella console
          </p>
        </div>
      )}
    </div>
  );
};

export default Results;
