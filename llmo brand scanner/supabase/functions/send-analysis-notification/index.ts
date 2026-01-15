import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisNotification {
  email: string;
  url: string;
  visibilityScore: number;
  brandName?: string;
  productName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, url, visibilityScore, brandName, productName }: AnalysisNotification = await req.json();

    console.log("Sending analysis notification to:", email);

    // Determine score color and message
    let scoreColor = "#f44336"; // red
    let scoreMessage = "Bassa visibilità";
    
    if (visibilityScore >= 70) {
      scoreColor = "#4caf50"; // green
      scoreMessage = "Ottima visibilità";
    } else if (visibilityScore >= 40) {
      scoreColor = "#ff9800"; // orange
      scoreMessage = "Visibilità media";
    }

    const emailResponse = await resend.emails.send({
      from: "AI Mentions Checker <onboarding@resend.dev>",
      to: [email],
      subject: `📊 Analisi completata${brandName ? ` - ${brandName}` : ''} (Score: ${visibilityScore}/100)`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: 500; font-style: italic;">
              Lino's <span style="font-weight: 300;">&</span> <span style="font-weight: 400;">co</span>
            </h1>
            <p style="color: #4caf50; margin: 0; font-size: 16px;">AI Mentions Checker</p>
          </div>
          
          <div style="background: #fafafa; padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 25px; text-align: center;">
              Analisi Agent‑Grade Completata ✨
            </h2>
            
            ${brandName || productName ? `
              <div style="background: white; padding: 20px; margin-bottom: 25px; border-radius: 12px; text-align: center;">
                ${brandName ? `<h3 style="color: #1a1a1a; margin: 0 0 5px 0; font-size: 20px;">${brandName}</h3>` : ''}
                ${productName ? `<p style="color: #666666; margin: 0; font-size: 16px;">${productName}</p>` : ''}
              </div>
            ` : ''}
            
            <div style="background: white; border-left: 4px solid ${scoreColor}; padding: 25px; margin-bottom: 25px; border-radius: 12px;">
              <div style="text-align: center;">
                <div style="display: inline-block; background: ${scoreColor}; color: white; padding: 15px 30px; border-radius: 50px; margin-bottom: 15px;">
                  <span style="font-size: 36px; font-weight: bold;">${visibilityScore}</span>
                  <span style="font-size: 20px;">/100</span>
                </div>
                <p style="margin: 10px 0 0 0; color: ${scoreColor}; font-weight: 500; font-size: 16px;">
                  ${scoreMessage}
                </p>
              </div>
            </div>
            
            <div style="background: white; padding: 25px; margin-bottom: 25px; border-radius: 12px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px;">URL Analizzato</h3>
              <p style="margin: 0; color: #666666; word-break: break-all; font-size: 14px;">
                <a href="${url}" style="color: #4caf50; text-decoration: none;">${url}</a>
              </p>
            </div>
            
            <div style="background: white; border-left: 4px solid #4caf50; padding: 25px; margin-bottom: 30px; border-radius: 12px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px;">Il tuo report include:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #666666; line-height: 1.8;">
                <li>Analisi tecnica SEO completa</li>
                <li>Test su 5+ assistenti AI (ChatGPT, Claude, Gemini...)</li>
                <li>Profilo dei bisogni dei tuoi clienti</li>
                <li>Prompt di ricerca generati automaticamente</li>
                <li>Raccomandazioni personalizzate</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get("VITE_SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://app.lovable.app'}/profile" 
                 style="background: #4caf50; color: white; padding: 14px 35px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 500; font-size: 16px; margin-bottom: 15px;">
                Vedi Report Completo
              </a>
              <br>
              <a href="${Deno.env.get("VITE_SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://app.lovable.app'}" 
                 style="color: #666666; text-decoration: none; font-size: 14px;">
                Fai un'altra analisi →
              </a>
            </div>
            
            <p style="color: #999999; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
              Vuoi migliorare la tua visibilità AI?<br>
              <a href="mailto:info@linosandco.com" style="color: #4caf50; text-decoration: none;">Richiedi una consulenza gratuita</a>
            </p>
          </div>
          
          <div style="background: #1a1a1a; padding: 25px; text-align: center;">
            <p style="color: #999999; font-size: 12px; margin: 0 0 8px 0;">
              AI Mentions Checker by Lino's & co
            </p>
            <p style="color: #666666; font-size: 11px; margin: 0;">
              Aiutiamo brand creativi ad essere scelti — anche dagli assistenti AI
            </p>
          </div>
        </div>
      `,
    });

    console.log("Analysis notification sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending analysis notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
