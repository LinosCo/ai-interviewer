import { Resend } from 'resend';
import net from 'node:net';
import tls from 'node:tls';
import { prisma } from '@/lib/prisma';

// Lazy initialization to prevent build errors when API key is not set
let resend: Resend | null = null;
const DEFAULT_FROM_EMAIL = 'Business Tuner <businesstuner@voler.ai>';
const DEFAULT_NOTIFICATION_EMAIL = 'businesstuner@voler.ai';

function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        'https://app.voler.ai'
    );
}

function getResendClient() {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

function extractEmailAddress(raw: string) {
    const match = raw.match(/<([^>]+)>/);
    return (match ? match[1] : raw).trim();
}

function readSmtpResponse(socket: net.Socket | tls.TLSSocket): Promise<string> {
    return new Promise((resolve, reject) => {
        let response = '';

        const onData = (chunk: Buffer | string) => {
            response += chunk.toString();
            const lines = response.split('\r\n').filter(Boolean);
            const lastLine = lines[lines.length - 1] || '';
            if (/^\d{3} /.test(lastLine)) {
                cleanup();
                resolve(response);
            }
        };

        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        const onClose = () => {
            cleanup();
            reject(new Error('SMTP connection closed unexpectedly'));
        };

        const cleanup = () => {
            socket.off('data', onData);
            socket.off('error', onError);
            socket.off('close', onClose);
        };

        socket.on('data', onData);
        socket.on('error', onError);
        socket.on('close', onClose);
    });
}

async function sendSmtpCommand(
    socket: net.Socket | tls.TLSSocket,
    command: string,
    expectedCodes: number[]
) {
    socket.write(`${command}\r\n`);
    const response = await readSmtpResponse(socket);
    const code = Number(response.slice(0, 3));
    if (!expectedCodes.includes(code)) {
        throw new Error(`SMTP command failed (${command}): ${response.trim()}`);
    }
    return response;
}

async function sendEmailViaSmtp(params: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    html: string;
}) {
    const { host, port, secure, user, pass, from, to, subject, html } = params;

    const socket = secure
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

    socket.setTimeout(20_000);
    socket.setEncoding('utf8');

    await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('error', reject);
        socket.once('timeout', () => reject(new Error('SMTP connection timeout')));
    });

    try {
        const greet = await readSmtpResponse(socket);
        if (!greet.startsWith('220')) {
            throw new Error(`SMTP greeting failed: ${greet.trim()}`);
        }

        await sendSmtpCommand(socket, `EHLO ${host}`, [250]);
        await sendSmtpCommand(socket, 'AUTH LOGIN', [334]);
        await sendSmtpCommand(socket, Buffer.from(user).toString('base64'), [334]);
        await sendSmtpCommand(socket, Buffer.from(pass).toString('base64'), [235]);
        await sendSmtpCommand(socket, `MAIL FROM:<${extractEmailAddress(from)}>`, [250]);
        await sendSmtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
        await sendSmtpCommand(socket, 'DATA', [354]);

        const headers = [
            `From: ${from}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
        ].join('\r\n');

        const escapedBody = html.replace(/\r?\n\./g, '\n..');
        socket.write(`${headers}${escapedBody}\r\n.\r\n`);
        const dataResponse = await readSmtpResponse(socket);
        const dataCode = Number(dataResponse.slice(0, 3));
        if (dataCode !== 250) {
            throw new Error(`SMTP DATA failed: ${dataResponse.trim()}`);
        }

        await sendSmtpCommand(socket, 'QUIT', [221]);
        socket.end();

        return { id: `smtp_${Date.now()}` };
    } catch (error) {
        socket.destroy();
        throw error;
    }
}

async function verifySmtpConnection(params: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
}) {
    const { host, port, secure, user, pass } = params;

    const socket = secure
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

    socket.setTimeout(20_000);
    socket.setEncoding('utf8');

    await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('error', reject);
        socket.once('timeout', () => reject(new Error('SMTP connection timeout')));
    });

    try {
        const greet = await readSmtpResponse(socket);
        if (!greet.startsWith('220')) {
            throw new Error(`SMTP greeting failed: ${greet.trim()}`);
        }

        await sendSmtpCommand(socket, `EHLO ${host}`, [250]);
        await sendSmtpCommand(socket, 'AUTH LOGIN', [334]);
        await sendSmtpCommand(socket, Buffer.from(user).toString('base64'), [334]);
        await sendSmtpCommand(socket, Buffer.from(pass).toString('base64'), [235]);
        await sendSmtpCommand(socket, 'QUIT', [221]);
        socket.end();
        return { success: true };
    } catch (error) {
        socket.destroy();
        throw error;
    }
}

export async function testEmailProviderConnection(overrides?: {
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpSecure?: boolean | null;
    smtpUser?: string | null;
    smtpPass?: string | null;
}) {
    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            smtpHost: true,
            smtpPort: true,
            smtpSecure: true,
            smtpUser: true,
            smtpPass: true,
            resendApiKey: true
        }
    }).catch(() => null);

    const smtpHost = overrides?.smtpHost ?? globalConfig?.smtpHost ?? process.env.SMTP_HOST ?? null;
    const smtpUser = overrides?.smtpUser ?? globalConfig?.smtpUser ?? process.env.SMTP_USER ?? null;
    const smtpPass = overrides?.smtpPass ?? globalConfig?.smtpPass ?? process.env.SMTP_PASS ?? null;
    const smtpPortRaw = overrides?.smtpPort ?? globalConfig?.smtpPort ?? process.env.SMTP_PORT ?? 465;
    const smtpPort = Number(smtpPortRaw);
    const smtpSecure = typeof (overrides?.smtpSecure) === 'boolean'
        ? Boolean(overrides?.smtpSecure)
        : typeof globalConfig?.smtpSecure === 'boolean'
            ? globalConfig.smtpSecure
            : (process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465);

    if (smtpHost && smtpUser && smtpPass) {
        try {
            await verifySmtpConnection({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure,
                user: smtpUser,
                pass: smtpPass
            });
            return {
                success: true,
                provider: 'smtp' as const,
                details: {
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    user: smtpUser
                }
            };
        } catch (error: any) {
            return {
                success: false,
                provider: 'smtp' as const,
                error: error?.message || 'SMTP validation failed',
                details: {
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    user: smtpUser
                }
            };
        }
    }

    const hasResend =
        Boolean(globalConfig?.resendApiKey) ||
        Boolean(process.env.RESEND_API_KEY);

    if (hasResend) {
        return {
            success: true,
            provider: 'resend' as const,
            details: { configured: true }
        };
    }

    return {
        success: false,
        provider: 'none' as const,
        error: 'No email provider configured. Set SMTP_* or RESEND_API_KEY.',
        details: {
            smtpHostConfigured: Boolean(smtpHost),
            smtpUserConfigured: Boolean(smtpUser),
            smtpPassConfigured: Boolean(smtpPass),
            resendConfigured: hasResend
        }
    };
}


export async function sendPasswordResetEmail(email: string, resetToken: string) {
    const appBaseUrl = getAppBaseUrl();
    const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;

    return sendEmail({
        to: email,
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
                            <a href="${appBaseUrl}/privacy" style="color: #9ca3af; text-decoration: none;">Privacy Policy</a> • 
                            <a href="${appBaseUrl}/terms" style="color: #9ca3af; text-decoration: none;">Termini di Servizio</a>
                        </p>
                    </div>
                </body>
                </html>
            `
    });
}

export async function sendAccountVerificationEmail(params: {
    to: string;
    token: string;
    userName?: string | null;
    nextPath?: string;
}) {
    const { to, token, userName, nextPath } = params;
    const appBaseUrl = getAppBaseUrl();
    const verificationUrl = `${appBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(to)}${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''}`;
    const greetingName = userName?.trim() || 'lì';

    return sendEmail({
        to,
        subject: 'Conferma il tuo account - Business Tuner',
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
                        <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Conferma il tuo account</h2>

                        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
                            Ciao ${greetingName},
                        </p>

                        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
                            Per attivare il tuo account, conferma il tuo indirizzo email cliccando sul pulsante qui sotto.
                        </p>

                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${verificationUrl}"
                               style="background: #f59e0b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">
                                Conferma Email
                            </a>
                        </div>

                        <p style="color: #6b7280; font-size: 14px; margin: 30px 0 10px 0;">
                            Oppure copia e incolla questo link nel tuo browser:
                        </p>
                        <p style="color: #3b82f6; font-size: 14px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px; margin: 0;">
                            ${verificationUrl}
                        </p>

                        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">
                                <strong>Questo link scadrà tra 24 ore.</strong>
                            </p>
                            <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">
                                Se non hai creato un account, puoi ignorare questa email.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `
    });
}

export async function sendLeadNotification(data: { name: string, surname: string, email: string, company: string, needs: string }) {
    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            smtpFromEmail: true,
            smtpNotificationEmail: true
        }
    }).catch(() => null);

    const result = await sendEmail({
        from: globalConfig?.smtpFromEmail || process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
        to: globalConfig?.smtpNotificationEmail || process.env.NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL,
        subject: `Nuovo Lead Business: ${data.company}`,
        html: `
                <h2>Nuova richiesta Business Plan</h2>
                <p><strong>Nome:</strong> ${data.name} ${data.surname}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Azienda:</strong> ${data.company}</p>
                <p><strong>Esigenze:</strong></p>
                <p>${data.needs}</p>
            `
    });
    return { success: result.success };
}

export async function sendSystemNotification(subject: string, content: string) {
    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            smtpFromEmail: true,
            smtpNotificationEmail: true
        }
    }).catch(() => null);

    const result = await sendEmail({
        from: globalConfig?.smtpFromEmail || process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
        to: globalConfig?.smtpNotificationEmail || process.env.NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL,
        subject: `[Business Tuner System] ${subject}`,
        html: `<div>${content}</div>`
    });
    return { success: result.success };
}

/**
 * Generic email sending function
 */
export async function sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
    smtpOverrides?: {
        host?: string | null;
        port?: number | null;
        secure?: boolean | null;
        user?: string | null;
        pass?: string | null;
        fromEmail?: string | null;
        resendApiKey?: string | null;
    };
}) {
    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            smtpHost: true,
            smtpPort: true,
            smtpSecure: true,
            smtpUser: true,
            smtpPass: true,
            smtpFromEmail: true,
            resendApiKey: true
        }
    }).catch(() => null);

    const from =
        params.from ??
        params.smtpOverrides?.fromEmail ??
        globalConfig?.smtpFromEmail ??
        process.env.EMAIL_FROM ??
        DEFAULT_FROM_EMAIL;

    const smtpHost = params.smtpOverrides?.host ?? globalConfig?.smtpHost ?? process.env.SMTP_HOST;
    const smtpUser = params.smtpOverrides?.user ?? globalConfig?.smtpUser ?? process.env.SMTP_USER;
    const smtpPass = params.smtpOverrides?.pass ?? globalConfig?.smtpPass ?? process.env.SMTP_PASS;
    const smtpPort = Number(params.smtpOverrides?.port ?? globalConfig?.smtpPort ?? process.env.SMTP_PORT ?? 465);
    const smtpSecure = typeof params.smtpOverrides?.secure === 'boolean'
        ? params.smtpOverrides.secure
        : typeof globalConfig?.smtpSecure === 'boolean'
            ? globalConfig.smtpSecure
        : (process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465);

    if (smtpHost && smtpUser && smtpPass) {
        try {
            const data = await sendEmailViaSmtp({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure,
                user: smtpUser,
                pass: smtpPass,
                from,
                to: params.to,
                subject: params.subject,
                html: params.html
            });
            return { success: true, data };
        } catch (error) {
            console.error('SMTP email send failed:', error);
            return { success: false, error };
        }
    }

    const resendApiKey = params.smtpOverrides?.resendApiKey ?? globalConfig?.resendApiKey ?? process.env.RESEND_API_KEY;
    if (!resend && resendApiKey) {
        resend = new Resend(resendApiKey);
    }
    const resendClient = getResendClient();
    if (!resendClient) {
        console.error('No email provider configured. Set SMTP_* or RESEND_API_KEY.');
        return { success: false, error: 'Email service not configured' };
    }

    try {
        const { data, error } = await resendClient.emails.send({
            from,
            to: [params.to],
            subject: params.subject,
            html: params.html
        });

        if (error) {
            console.error('Error sending email:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Failed to send email:', error);
        return { success: false, error };
    }
}

// ============================================
// CREDIT NOTIFICATION EMAILS
// ============================================

const baseUrl = getAppBaseUrl();

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
    <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Business Tuner</h1>
        </div>
        <div style="padding: 30px;">
            ${content}
        </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 5px 0;">© 2025 Business Tuner. Tutti i diritti riservati.</p>
    </div>
</body>
</html>
`;

/**
 * Invia notifica quando i crediti raggiungono l'85% (danger)
 */
export async function sendCreditsWarningEmail(params: {
    to: string;
    userName: string;
    percentageUsed: number;
    creditsRemaining: string;
    resetDate: string;
}) {
    const { to, userName, percentageUsed, creditsRemaining, resetDate } = params;

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #FEF3C7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">⚠️</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Crediti in esaurimento</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${userName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Hai utilizzato il <strong style="color: #d97706;">${percentageUsed}%</strong> dei tuoi crediti mensili.
        </p>

        <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; color: #92400E; font-size: 14px; font-weight: 600;">Crediti rimanenti</p>
            <p style="margin: 0; color: #B45309; font-size: 28px; font-weight: 700;">${creditsRemaining}</p>
            <p style="margin: 8px 0 0 0; color: #92400E; font-size: 12px;">Reset previsto: ${resetDate}</p>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Per continuare a usare tutte le funzionalità AI senza interruzioni, puoi acquistare un pack di crediti aggiuntivi o passare a un piano superiore.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/dashboard/billing?tab=packs"
               style="background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; margin: 0 8px;">
                Acquista crediti
            </a>
            <a href="${baseUrl}/dashboard/billing/plans"
               style="background: #1f2937; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; margin: 0 8px;">
                Upgrade piano
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: '⚠️ I tuoi crediti stanno per esaurirsi - Business Tuner',
        html: emailWrapper(content)
    });
}

/**
 * Invia notifica quando i crediti sono esauriti (100%)
 */
export async function sendCreditsExhaustedEmail(params: {
    to: string;
    userName: string;
    resetDate: string;
}) {
    const { to, userName, resetDate } = params;

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #FEE2E2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">🚫</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Crediti esauriti</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${userName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Hai esaurito i crediti mensili del tuo piano. Le funzionalità AI sono temporaneamente sospese.
        </p>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0; color: #991B1B; font-size: 14px;">
                <strong>Funzionalità sospese:</strong>
            </p>
            <ul style="color: #7F1D1D; font-size: 14px; margin: 12px 0 0 0; padding-left: 20px;">
                <li>Nuove interviste AI</li>
                <li>Sessioni chatbot</li>
                <li>Visibility Tracker</li>
                <li>AI Tips e Copilot</li>
            </ul>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            I crediti si rinnoveranno automaticamente il <strong>${resetDate}</strong>.
            <br><br>
            Per ripristinare subito l'accesso, acquista un pack di crediti o passa a un piano superiore.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/dashboard/billing?tab=packs"
               style="background: #DC2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; margin: 0 8px;">
                Acquista crediti ora
            </a>
            <a href="${baseUrl}/dashboard/billing/plans"
               style="background: #1f2937; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; margin: 0 8px;">
                Upgrade piano
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: '🚫 Crediti esauriti - Azione richiesta - Business Tuner',
        html: emailWrapper(content)
    });
}

/**
 * Invia conferma acquisto pack crediti
 */
export async function sendCreditsPurchaseConfirmation(params: {
    to: string;
    userName: string;
    packName: string;
    creditsAdded: string;
    pricePaid: string;
    newTotal: string;
}) {
    const { to, userName, packName, creditsAdded, pricePaid, newTotal } = params;

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #D1FAE5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">✅</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Acquisto completato!</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${userName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Il tuo acquisto di crediti è stato completato con successo.
        </p>

        <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0;">Pack acquistato</td>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${packName}</td>
                </tr>
                <tr>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0;">Crediti aggiunti</td>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${creditsAdded}</td>
                </tr>
                <tr>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0;">Importo pagato</td>
                    <td style="color: #166534; font-size: 14px; padding: 8px 0; text-align: right; font-weight: 600;">${pricePaid}</td>
                </tr>
                <tr style="border-top: 1px solid #BBF7D0;">
                    <td style="color: #166534; font-size: 16px; padding: 12px 0 0 0; font-weight: 700;">Nuovo saldo</td>
                    <td style="color: #166534; font-size: 20px; padding: 12px 0 0 0; text-align: right; font-weight: 700;">${newTotal}</td>
                </tr>
            </table>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">
            I crediti acquistati non scadono e vengono utilizzati dopo i crediti mensili del tuo piano.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/dashboard/billing"
               style="background: #1f2937; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                Vai alla dashboard
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: '✅ Acquisto crediti completato - Business Tuner',
        html: emailWrapper(content)
    });
}

/**
 * Invia notifica fine trial partner
 */
export async function sendPartnerTrialEndingEmail(params: {
    to: string;
    userName: string;
    daysRemaining: number;
    activeClients: number;
    requiredClients: number;
}) {
    const { to, userName, daysRemaining, activeClients, requiredClients } = params;

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #E0E7FF; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">⏰</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Il tuo trial Partner sta per scadere</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${userName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Il tuo periodo di prova del piano Partner scadrà tra <strong>${daysRemaining} giorni</strong>.
        </p>

        <div style="background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; color: #3730A3; font-size: 14px; font-weight: 600;">Il tuo stato attuale:</p>
            <p style="margin: 0; color: #4338CA; font-size: 16px;">
                <strong>${activeClients}</strong> clienti attivi su <strong>${requiredClients}</strong> richiesti per la gratuità
            </p>
            ${activeClients < requiredClients ? `
                <p style="margin: 12px 0 0 0; color: #6366F1; font-size: 14px;">
                    Ti mancano <strong>${requiredClients - activeClients}</strong> clienti per mantenere il piano gratuito.
                </p>
            ` : `
                <p style="margin: 12px 0 0 0; color: #059669; font-size: 14px;">
                    ✓ Ottimo! Hai raggiunto la soglia per la gratuità.
                </p>
            `}
        </div>

        ${activeClients < requiredClients ? `
            <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
                Se non raggiungi ${requiredClients} clienti entro la fine del trial, il piano Partner costerà €29/mese.
            </p>
        ` : ''}

        <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/dashboard/partner"
               style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                Gestisci Partner
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: `⏰ Trial Partner: ${daysRemaining} giorni rimanenti - Business Tuner`,
        html: emailWrapper(content)
    });
}

/**
 * Invia notifica trial partner scaduto con invito a richiedere proroga.
 */
export async function sendPartnerTrialExpiredEmail(params: {
    to: string;
    userName: string;
    activeClients: number;
    requiredClients: number;
}) {
    const { to, userName, activeClients, requiredClients } = params;

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #FEE2E2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">📣</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Il trial Partner è terminato</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${userName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Il tuo periodo di prova Partner è terminato.
        </p>

        <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; color: #9A3412; font-size: 14px; font-weight: 600;">Situazione clienti attiva:</p>
            <p style="margin: 0; color: #C2410C; font-size: 16px;">
                <strong>${activeClients}</strong> clienti paganti attivi su <strong>${requiredClients}</strong> richiesti per fee €0/mese
            </p>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Se desideri una proroga del trial Partner, contatta il team Business Tuner.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="mailto:businesstuner@voler.ai?subject=Richiesta%20proroga%20trial%20Partner"
               style="background: #1f2937; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                Contatta Business Tuner
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: 'Trial Partner terminato - Richiedi proroga',
        html: emailWrapper(content)
    });
}

/**
 * Invia email di benvenuto dopo registrazione
 */
export async function sendWelcomeEmail(params: {
    to: string;
    userName?: string | null;
}) {
    const { to, userName } = params;
    const greetingName = userName?.trim() || 'lì';

    const content = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 60px; height: 60px; background: #DBEAFE; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="font-size: 28px;">🎉</span>
            </div>
            <h2 style="color: #1f2937; margin: 0; font-size: 22px;">Benvenuto in Business Tuner</h2>
        </div>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Ciao ${greetingName},
        </p>

        <p style="color: #4b5563; font-size: 16px; margin: 20px 0;">
            Il tuo account è attivo. Puoi iniziare subito a creare interviste AI, chatbot e analisi di visibility.
        </p>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 10px 0; color: #0F172A; font-size: 14px; font-weight: 600;">Passi consigliati:</p>
            <ul style="color: #334155; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>Completa il setup iniziale del progetto</li>
                <li>Crea il tuo primo bot/intervista</li>
                <li>Invita il team in dashboard settings</li>
            </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
            <a href="${baseUrl}/dashboard"
               style="background: #2563EB; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                Vai alla dashboard
            </a>
        </div>
    `;

    return sendEmail({
        to,
        subject: '🎉 Benvenuto su Business Tuner',
        html: emailWrapper(content)
    });
}
