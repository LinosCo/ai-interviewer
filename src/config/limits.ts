/**
 * LIMITI TECNICI NASCOSTI
 * 
 * Questi limiti NON vengono mostrati nella pricing page
 * ma sono enforced a livello di sistema per:
 * 1. Controllare i costi LLM
 * 2. Prevenire abusi
 * 3. Garantire qualità del servizio
 */

export const HIDDEN_LIMITS = {
    // ============================================
    // CONVERSAZIONE (per singola intervista)
    // ============================================
    conversation: {
        trial: {
            maxExchanges: 10,           // Scambi domanda/risposta
            maxTokensTotal: 30000,      // Token totali conversazione
            maxCharsPerMessage: 1000,   // Caratteri per messaggio utente
            inactivityTimeout: 20,      // Minuti prima di chiusura automatica
        },
        starter: {
            maxExchanges: 15,
            maxTokensTotal: 50000,
            maxCharsPerMessage: 2000,
            inactivityTimeout: 30,
        },
        pro: {
            maxExchanges: 20,
            maxTokensTotal: 70000,
            maxCharsPerMessage: 3000,
            inactivityTimeout: 45,
        },
        business: {
            maxExchanges: 25,
            maxTokensTotal: 100000,
            maxCharsPerMessage: 5000,
            inactivityTimeout: 60,
        }
    },

    // ============================================
    // CONFIGURAZIONE BOT
    // ============================================
    botConfig: {
        trial: {
            maxQuestions: 6,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,
        },
        starter: {
            maxQuestions: 10,
            maxKnowledgeBaseChars: 0,
            maxKnowledgeBaseFiles: 0,
        },
        pro: {
            maxQuestions: 15,
            maxKnowledgeBaseChars: 50000,    // ~12.500 parole
            maxKnowledgeBaseFiles: 3,
        },
        business: {
            maxQuestions: 20,
            maxKnowledgeBaseChars: 200000,   // ~50.000 parole
            maxKnowledgeBaseFiles: 10,
        }
    },

    // ============================================
    // TEST E SIMULAZIONI (anti-abuso)
    // ============================================
    testing: {
        trial: {
            simulationsPerDayPerBot: 2,
            aiRegenerationsPerDay: 3,
        },
        starter: {
            simulationsPerDayPerBot: 5,
            aiRegenerationsPerDay: 10,
        },
        pro: {
            simulationsPerDayPerBot: 10,
            aiRegenerationsPerDay: 25,
        },
        business: {
            simulationsPerDayPerBot: 20,
            aiRegenerationsPerDay: 50,
        }
    },

    // ============================================
    // RATE LIMITS
    // ============================================
    rateLimit: {
        trial: {
            maxParallelInterviews: 2,
            messageCooldownMs: 3000,
            requestsPerMinute: 10,
        },
        starter: {
            maxParallelInterviews: 10,
            messageCooldownMs: 2000,
            requestsPerMinute: 30,
        },
        pro: {
            maxParallelInterviews: 30,
            messageCooldownMs: 1000,
            requestsPerMinute: 60,
        },
        business: {
            maxParallelInterviews: 100,
            messageCooldownMs: 500,
            requestsPerMinute: 120,
        }
    }
} as const;

export type PlanKey = keyof typeof HIDDEN_LIMITS.conversation;
