
export const FEATURE_MATRIX = {
    categories: [
        {
            name: 'Creazione Interviste',
            features: [
                { key: 'aiGeneration', label: 'Generazione AI da obiettivo', trial: true, starter: true, pro: true, business: true },
                { key: 'basicTemplates', label: 'Template base (5)', trial: true, starter: true, pro: true, business: true },
                { key: 'advancedTemplates', label: 'Template avanzati (15+)', trial: false, starter: true, pro: true, business: true },
                { key: 'manualEdit', label: 'Modifica domande manuale', trial: false, starter: true, pro: true, business: true },
                { key: 'knowledgeBase', label: 'Knowledge base personalizzato', trial: false, starter: false, pro: true, business: true },
                { key: 'conditionalLogic', label: 'Logica condizionale (branching)', trial: false, starter: false, pro: true, business: true },
                { key: 'customTemplates', label: 'Template custom su richiesta', trial: false, starter: false, pro: false, business: true }
            ]
        },
        {
            name: 'Branding',
            features: [
                { key: 'watermark', label: 'Senza watermark', trial: false, starter: false, pro: true, business: true },
                { key: 'customColor', label: 'Colore primario personalizzato', trial: false, starter: true, pro: true, business: true },
                { key: 'customLogo', label: 'Logo aziendale', trial: false, starter: false, pro: true, business: true },
                { key: 'customDomain', label: 'Dominio personalizzato (CNAME)', trial: false, starter: false, pro: false, business: true }
            ]
        },
        {
            name: 'Analytics',
            features: [
                { key: 'basicStats', label: 'Conteggio risposte e completamento', trial: true, starter: true, pro: true, business: true },
                { key: 'transcripts', label: 'Lettura trascrizioni', trial: true, starter: true, pro: true, business: true },
                { key: 'sentiment', label: 'Sentiment analysis', trial: false, starter: true, pro: true, business: true },
                { key: 'themeExtraction', label: 'Estrazione temi automatica', trial: false, starter: true, pro: true, business: true },
                { key: 'keyQuotes', label: 'Citazioni chiave estratte', trial: false, starter: true, pro: true, business: true },
                { key: 'trends', label: 'Trend nel tempo (storico)', trial: false, starter: false, pro: true, business: true },
                { key: 'comparison', label: 'Confronto tra interviste', trial: false, starter: false, pro: true, business: true },
                { key: 'segmentation', label: 'Segmentazione risposte', trial: false, starter: false, pro: false, business: true },
                { key: 'customDashboards', label: 'Dashboard personalizzabili', trial: false, starter: false, pro: false, business: true }
            ]
        },
        {
            name: 'Export e Integrazioni',
            features: [
                { key: 'exportCsv', label: 'Export CSV dati grezzi', trial: false, starter: false, pro: true, business: true },
                { key: 'webhooks', label: 'Webhook (notifiche in uscita)', trial: false, starter: false, pro: true, business: true },
                { key: 'zapier', label: 'Integrazione Zapier', trial: false, starter: false, pro: false, business: true },
                { key: 'sso', label: 'SSO (SAML/OIDC)', trial: false, starter: false, pro: false, business: true }
            ]
        },
        {
            name: 'Supporto',
            features: [
                { key: 'supportCommunity', label: 'Community', trial: true, starter: false, pro: false, business: false },
                { key: 'supportEmail', label: 'Email', trial: false, starter: true, pro: false, business: false },
                { key: 'supportPriority', label: 'Prioritario', trial: false, starter: false, pro: true, business: false },
                { key: 'supportDedicated', label: 'Dedicato + Onboarding', trial: false, starter: false, pro: false, business: true }
            ]
        }
    ]
};
