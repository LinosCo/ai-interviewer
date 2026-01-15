import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsultationRequest {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  siteUrl?: string;
  visibilityScore?: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, company, phone, message, siteUrl, visibilityScore }: ConsultationRequest = await req.json();

    console.log("Processing consultation request from:", email);

    // Send notification email to Lino's & co team
    const teamEmailResponse = await resend.emails.send({
      from: "AI Mentions Checker <onboarding@resend.dev>",
      to: ["info@linosandco.com"], // Replace with actual Lino's & co email
      subject: "🔔 Nuova Richiesta di Consulenza",
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 500; font-style: italic;">
              Lino's <span style="font-weight: 300;">&</span> <span style="font-weight: 400;">co</span>
            </h1>
          </div>
          
          <div style="background: #fafafa; padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">
              Nuova Richiesta di Consulenza
            </h2>
            
            <div style="background: white; border-left: 4px solid #4caf50; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Informazioni Cliente</h3>
              <p style="margin: 8px 0;"><strong>Nome:</strong> ${name}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
              ${company ? `<p style="margin: 8px 0;"><strong>Azienda:</strong> ${company}</p>` : ''}
              ${phone ? `<p style="margin: 8px 0;"><strong>Telefono:</strong> ${phone}</p>` : ''}
            </div>
            
            ${siteUrl ? `
            <div style="background: white; border-left: 4px solid #666666; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Analisi Effettuata</h3>
              <p style="margin: 8px 0;"><strong>Sito:</strong> ${siteUrl}</p>
              ${visibilityScore ? `<p style="margin: 8px 0;"><strong>Punteggio Visibilità:</strong> ${visibilityScore}/100</p>` : ''}
            </div>
            ` : ''}
            
            ${message ? `
            <div style="background: white; border-left: 4px solid #666666; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
              <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Messaggio</h3>
              <p style="margin: 0; color: #666666; line-height: 1.6;">${message}</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="mailto:${email}" style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500;">
                Rispondi al Cliente
              </a>
            </div>
          </div>
          
          <div style="background: #1a1a1a; padding: 20px; text-align: center; color: #999999; font-size: 12px;">
            <p style="margin: 0;">AI Mentions Checker by Lino's & co</p>
          </div>
        </div>
      `,
    });

    console.log("Team notification email sent:", teamEmailResponse);

    // Send confirmation email to the client
    const clientEmailResponse = await resend.emails.send({
      from: "Lino's & co <onboarding@resend.dev>",
      to: [email],
      subject: "✅ Richiesta di Consulenza Ricevuta",
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 500; font-style: italic;">
              Lino's <span style="font-weight: 300;">&</span> <span style="font-weight: 400;">co</span>
            </h1>
          </div>
          
          <div style="background: #fafafa; padding: 40px 30px;">
            <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">
              Ciao ${name}!
            </h2>
            
            <p style="color: #666666; line-height: 1.6; font-size: 16px;">
              Abbiamo ricevuto la tua richiesta di consulenza e siamo entusiasti di aiutarti a migliorare la visibilità del tuo brand sugli AI.
            </p>
            
            <div style="background: white; border-left: 4px solid #4caf50; padding: 20px; margin: 30px 0; border-radius: 8px;">
              <p style="margin: 0; color: #1a1a1a; font-size: 16px;">
                <strong>Il nostro team ti contatterà entro 24-48 ore</strong> per fissare un appuntamento e discutere le strategie migliori per ottimizzare la tua presenza online.
              </p>
            </div>
            
            <p style="color: #666666; line-height: 1.6; font-size: 16px; margin-bottom: 30px;">
              Nel frattempo, se hai domande urgenti, non esitare a rispondere a questa email.
            </p>
            
            <div style="text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">Seguici sui nostri canali</p>
              <p style="margin: 0; color: #1a1a1a; font-weight: 500;">www.linosandco.com</p>
            </div>
          </div>
          
          <div style="background: #1a1a1a; padding: 20px; text-align: center; color: #999999; font-size: 12px;">
            <p style="margin: 0;">AI Mentions Checker by Lino's & co</p>
            <p style="margin: 5px 0 0 0;">Ottimizza la tua visibilità sugli AI</p>
          </div>
        </div>
      `,
    });

    console.log("Client confirmation email sent:", clientEmailResponse);

    return new Response(
      JSON.stringify({ success: true, teamEmail: teamEmailResponse, clientEmail: clientEmailResponse }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-consultation-request function:", error);
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
