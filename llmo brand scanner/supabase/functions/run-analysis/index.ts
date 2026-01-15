import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { run_id } = await req.json();
    
    if (!run_id) {
      throw new Error("run_id is required");
    }

    console.log("Starting analysis for run_id:", run_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the analysis run with related data
    const { data: run, error: runError } = await supabase
      .from("analysis_runs")
      .select(`
        id,
        project_id,
        brand_id,
        prompt_id,
        model_id,
        status
      `)
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      console.error("Error fetching run:", runError);
      throw new Error("Analysis run not found");
    }

    // Fetch prompt text
    const { data: prompt } = await supabase
      .from("prompts")
      .select("text")
      .eq("id", run.prompt_id)
      .single();

    // Fetch brand info
    const { data: brand } = await supabase
      .from("brands")
      .select("name, description, website_url, competitors")
      .eq("id", run.brand_id)
      .single();

    // Fetch AI model info
    const { data: model } = await supabase
      .from("ai_models")
      .select("name, display_name")
      .eq("id", run.model_id)
      .single();

    if (!prompt || !brand || !model) {
      throw new Error("Missing required data (prompt, brand, or model)");
    }

    console.log("Running analysis for brand:", brand.name, "with model:", model.display_name);

    // Update status to running
    await supabase
      .from("analysis_runs")
      .update({ status: "running" })
      .eq("id", run_id);

    const startTime = Date.now();

    // Build the system prompt for AI visibility analysis
    const systemPrompt = `Sei un assistente AI che simula come altri assistenti AI risponderebbero a domande degli utenti.
Quando rispondi, devi:
1. Rispondere naturalmente alla domanda dell'utente
2. Se il brand "${brand.name}" è rilevante, menzionalo nella risposta
3. Se ci sono competitor noti (${brand.competitors?.join(", ") || "nessuno specificato"}), puoi menzionarli se pertinenti
4. Fornisci una risposta utile e informativa

Dopo la risposta, aggiungi una sezione "---ANALISI---" con:
- BRAND_MENTIONED: true/false (se hai menzionato ${brand.name})
- BRAND_POSITION: numero da 1 a 10 (1 = menzionato per primo, 10 = non menzionato)
- SENTIMENT: positive/neutral/negative (come hai parlato del brand)
- COMPETITORS_MENTIONED: lista dei competitor menzionati separati da virgola
- CONFIDENCE: numero da 0 a 100 (quanto sei sicuro dell'analisi)`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt.text },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        await supabase
          .from("analysis_runs")
          .update({ 
            status: "error", 
            error_message: "Rate limit exceeded. Please try again later.",
            completed_at: new Date().toISOString()
          })
          .eq("id", run_id);
        
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        await supabase
          .from("analysis_runs")
          .update({ 
            status: "error", 
            error_message: "Payment required. Please add credits.",
            completed_at: new Date().toISOString()
          })
          .eq("id", run_id);
        
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawResponse = aiData.choices?.[0]?.message?.content || "";
    const executionTime = Date.now() - startTime;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    console.log("AI response received, parsing results...");

    // Parse the analysis section
    let brandMentioned = false;
    let brandPosition: number | null = null;
    let sentiment: string | null = null;
    let competitorsMentioned: string[] = [];
    let confidence: number | null = null;

    const analysisMatch = rawResponse.match(/---ANALISI---(.+)$/s);
    if (analysisMatch) {
      const analysisText = analysisMatch[1];
      
      const mentionedMatch = analysisText.match(/BRAND_MENTIONED:\s*(true|false)/i);
      if (mentionedMatch) brandMentioned = mentionedMatch[1].toLowerCase() === "true";
      
      const positionMatch = analysisText.match(/BRAND_POSITION:\s*(\d+)/i);
      if (positionMatch) brandPosition = parseInt(positionMatch[1]);
      
      const sentimentMatch = analysisText.match(/SENTIMENT:\s*(positive|neutral|negative)/i);
      if (sentimentMatch) sentiment = sentimentMatch[1].toLowerCase();
      
      const competitorsMatch = analysisText.match(/COMPETITORS_MENTIONED:\s*(.+)/i);
      if (competitorsMatch && competitorsMatch[1].trim() !== "nessuno" && competitorsMatch[1].trim() !== "") {
        competitorsMentioned = competitorsMatch[1].split(",").map((c: string) => c.trim()).filter((c: string) => c);
      }
      
      const confidenceMatch = analysisText.match(/CONFIDENCE:\s*(\d+)/i);
      if (confidenceMatch) confidence = parseInt(confidenceMatch[1]);
    }

    // Update analysis run with results
    const { error: updateError } = await supabase
      .from("analysis_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        raw_response: rawResponse,
        brand_mentioned: brandMentioned,
        brand_position: brandPosition,
        sentiment: sentiment,
        competitors_mentioned: competitorsMentioned,
        confidence_score: confidence,
        execution_time_ms: executionTime,
        tokens_used: tokensUsed,
      })
      .eq("id", run_id);

    if (updateError) {
      console.error("Error updating run:", updateError);
    }

    // Calculate and update visibility metrics
    const today = new Date();
    const periodStart = new Date(today);
    periodStart.setDate(today.getDate() - 7);
    
    // Check if metric exists for this period
    const { data: existingMetric } = await supabase
      .from("visibility_metrics")
      .select("id, total_runs, successful_runs, visibility_score, sentiment_score, avg_position")
      .eq("brand_id", run.brand_id)
      .eq("model_id", run.model_id)
      .gte("period_start", periodStart.toISOString().split("T")[0])
      .lte("period_end", today.toISOString().split("T")[0])
      .maybeSingle();

    if (existingMetric) {
      // Update existing metric
      const newTotalRuns = (existingMetric.total_runs || 0) + 1;
      const newSuccessfulRuns = (existingMetric.successful_runs || 0) + (brandMentioned ? 1 : 0);
      const newVisibilityScore = Math.round((newSuccessfulRuns / newTotalRuns) * 100);
      
      // Calculate average sentiment (-1 to 1 scale)
      const sentimentValue = sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;
      const oldSentimentSum = (existingMetric.sentiment_score || 0) * (existingMetric.total_runs || 1);
      const newSentimentScore = (oldSentimentSum + sentimentValue) / newTotalRuns;
      
      // Calculate average position
      const oldPositionSum = (existingMetric.avg_position || 5) * (existingMetric.total_runs || 1);
      const newAvgPosition = (oldPositionSum + (brandPosition || 10)) / newTotalRuns;

      await supabase
        .from("visibility_metrics")
        .update({
          total_runs: newTotalRuns,
          successful_runs: newSuccessfulRuns,
          visibility_score: newVisibilityScore,
          sentiment_score: newSentimentScore,
          avg_position: newAvgPosition,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMetric.id);
    } else {
      // Create new metric
      const visibilityScore = brandMentioned ? 100 : 0;
      const sentimentScore = sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;

      await supabase
        .from("visibility_metrics")
        .insert({
          brand_id: run.brand_id,
          model_id: run.model_id,
          period_start: periodStart.toISOString().split("T")[0],
          period_end: today.toISOString().split("T")[0],
          visibility_score: visibilityScore,
          sentiment_score: sentimentScore,
          avg_position: brandPosition || 10,
          total_runs: 1,
          successful_runs: brandMentioned ? 1 : 0,
          mention_rate: brandMentioned ? 100 : 0,
        });
    }

    console.log("Analysis completed successfully for run_id:", run_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        run_id,
        brand_mentioned: brandMentioned,
        brand_position: brandPosition,
        sentiment,
        confidence
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in run-analysis:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
