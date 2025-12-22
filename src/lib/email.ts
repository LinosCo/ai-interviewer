import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(email: string, resetToken: string) {
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'Business Tuner <noreply@businesstuner.ai>',
            to: [email],
            subject: 'Recupera la tua password - Business Tuner',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Business Tuner</h1>
                    </div>
                    
                    <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                        <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Recupera la tua password</h2>
                        
                        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
                            Hai richiesto di reimpostare la password per il tuo account Business Tuner.
                        </p>
                        
                        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
                            Clicca sul pulsante qui sotto per creare una nuova password:
                        </p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${resetUrl}" 
                               style="background: #f59e0b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">
                                Reimposta Password
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; margin: 30px 0 10px 0;">
                            Oppure copia e incolla questo link nel tuo browser:
                        </p>
                        <p style="color: #3b82f6; font-size: 14px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 0;">
                            ${resetUrl}
                        </p>
                        
                        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">
                                <strong>Questo link scadrà tra 1 ora.</strong>
                            </p>
                            <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">
                                Se non hai richiesto il recupero della password, puoi ignorare questa email in sicurezza.
                            </p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                        <p style="margin: 5px 0;">© 2025 Business Tuner. Tutti i diritti riservati.</p>
                        <p style="margin: 5px 0;">
                            <a href="${process.env.NEXTAUTH_URL}/privacy" style="color: #9ca3af; text-decoration: none;">Privacy Policy</a> • 
                            <a href="${process.env.NEXTAUTH_URL}/terms" style="color: #9ca3af; text-decoration: none;">Termini di Servizio</a>
                        </p>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error sending password reset email:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send password reset email:', error);
        return { success: false, error };
    }
}
