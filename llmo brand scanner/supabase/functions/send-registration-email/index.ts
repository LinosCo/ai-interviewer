import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationEmail {
  email: string;
  name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: RegistrationEmail = await req.json();

    console.log("Sending registration confirmation to:", email);

    const emailResponse = await resend.emails.send({
      from: "AI Mentions Checker <onboarding@resend.dev>",
      to: [email],
      subject: "✨ Benvenuto in AI Mentions Checker",
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: 500; font-style: italic;">
              Lino's <span style="font-weight: 300;">&</span> <span style="font-weight: 400;">co</span>
            </h1>
            <p style="color: #4caf50; margin: 0; font-size: 16px;">AI Mentions Checker</p>
          </div>
          
          <div style="background: #fafafa; padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 28px; margin-bottom: 20px; text-align: center;">
              Benvenuto${name ? `, ${name}` : ''}! 🎉
            </h2>
            
            <p style="color: #666666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Grazie per esserti registrato ad <strong>AI Mentions Checker</strong>. 
              Ora puoi accedere a tutte le funzionalità avanzate della piattaforma.
            </p>
            
            <div style="background: white; border-left: 4px solid #4caf50; padding: 25px; margin: 30px 0; border-radius: 12px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a; font-size: 18px;">Cosa puoi fare ora:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #666666; line-height: 1.8;">
                <li>Analizzare fino a 5 URL gratuitamente</li>
                <li>Testare la visibilità su 5+ assistenti AI</li>
                <li>Accedere allo storico delle tue analisi</li>
                <li>Scaricare report dettagliati in PDF</li>
                <li>Richiedere consulenze personalizzate</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get("VITE_SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://app.lovable.app'}" 
                 style="background: #4caf50; color: white; padding: 14px 35px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 500; font-size: 16px;">
                Vai al tuo Profilo
              </a>
            </div>
            
            <p style="color: #999999; font-size: 14px; text-align: center; margin-top: 30px; line-height: 1.6;">
              Hai domande? Siamo qui per aiutarti.<br>
              Contattaci: <a href="mailto:info@linosandco.com" style="color: #4caf50; text-decoration: none;">info@linosandco.com</a>
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

    console.log("Registration email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending registration email:", error);
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
