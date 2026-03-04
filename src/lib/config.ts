import { prisma } from '@/lib/prisma';

export type ConfigKey =
    | 'openaiApiKey'
    | 'anthropicApiKey'
    | 'geminiApiKey'
    | 'googleSerpApiKey'
    | 'stripeSecretKey'
    | 'stripeWebhookSecret'
    | 'smtpHost'
    | 'smtpUser'
    | 'smtpPass'
    | 'smtpPort'
    | 'smtpSecure';

const ENV_VAR_MAP: Record<ConfigKey, string> = {
    openaiApiKey:        'OPENAI_API_KEY',
    anthropicApiKey:     'ANTHROPIC_API_KEY',
    geminiApiKey:        'GEMINI_API_KEY',
    googleSerpApiKey:    'GOOGLE_SERP_API_KEY',
    stripeSecretKey:     'STRIPE_SECRET_KEY',
    stripeWebhookSecret: 'STRIPE_WEBHOOK_SECRET',
    smtpHost:            'SMTP_HOST',
    smtpUser:            'SMTP_USER',
    smtpPass:            'SMTP_PASS',
    smtpPort:            'SMTP_PORT',
    smtpSecure:          'SMTP_SECURE',
};

export class ConfigurationError extends Error {
    constructor(key: ConfigKey) {
        super(
            `[config] "${key}" non configurato in GlobalConfig. ` +
            `Impostalo tramite Admin → Impostazioni Piattaforma.`
        );
        this.name = 'ConfigurationError';
    }
}

let _cache: Record<string, string | null> | null = null;
let _cacheTime = 0;
let _inflightPromise: Promise<Record<string, string | null>> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getGlobalConfigFromDb(): Promise<Record<string, string | null>> {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;
    if (_inflightPromise) return _inflightPromise;

    _inflightPromise = (async () => {
        try {
            const row = await prisma.globalConfig.findUnique({ where: { id: 'default' } });
            _cache = row
                ? (Object.fromEntries(
                    Object.entries(row).map(([k, v]) => [k, v === null || v === undefined ? null : String(v)])
                ) as Record<string, string | null>)
                : {};
            _cacheTime = Date.now();
            return _cache;
        } catch (err) {
            console.error('[config] Failed to load GlobalConfig from DB:', err);
            return {};
        } finally {
            _inflightPromise = null;
        }
    })();

    return _inflightPromise;
}

export async function getConfigValue(key: ConfigKey): Promise<string | null> {
    const config = await getGlobalConfigFromDb();
    const dbValue = config[key];
    if (dbValue !== null && dbValue !== undefined && dbValue !== '') return dbValue;

    if (process.env.NODE_ENV === 'production') {
        throw new ConfigurationError(key);
    }

    const envVar = ENV_VAR_MAP[key];
    const envValue = process.env[envVar];
    if (envValue) {
        console.warn(`[config] "${key}" non in GlobalConfig — uso env var ${envVar} (solo dev)`);
        return envValue;
    }

    return null;
}

export function invalidateConfigCache(): void {
    _cache = null;
    _cacheTime = 0;
    _inflightPromise = null;
}
