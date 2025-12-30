
export const PRICING_PAGE = {
    headline: "Scegli il piano giusto per te",
    subheadline: "Inizia gratis, scala quando serve. Nessun vincolo.",

    plans: [
        {
            id: 'starter',
            name: 'Starter',
            price: '€49',
            period: '/mese',
            description: 'Per il professionista',
            cta: 'Inizia 14 giorni gratis',
            highlighted: false,
            features: [
                '3 interviste attive',
                '100 risposte/mese',
                'Tutti i template',
                'Analytics completi',
                'Sentiment e temi',
                'Export PDF',
                'Supporto email'
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '€149',
            period: '/mese',
            description: 'Per la PMI',
            cta: 'Inizia 14 giorni gratis',
            highlighted: true,
            badge: '⭐ Più popolare',
            features: [
                '10 interviste attive',
                '300 risposte/mese',
                '5 utenti inclusi',
                'Knowledge base AI',
                'Logica condizionale',
                'Trend nel tempo',
                'Logo aziendale',
                'Nessun watermark',
                'Export CSV + Webhook',
                'Supporto prioritario'
            ]
        },
        {
            id: 'business',
            name: 'Business',
            price: '€299',
            period: '/mese',
            description: 'Per l\'azienda strutturata',
            cta: 'Contattaci',
            highlighted: false,
            features: [
                'Interviste illimitate',
                '1.000 risposte/mese',
                '15 utenti inclusi',
                'Tutto di Pro +',
                'White label completo',
                'Dominio personalizzato',
                'API REST + Zapier',
                'SSO (SAML/OIDC)',
                'Onboarding dedicato',
                'Account manager'
            ]
        }
    ],

    addons: [
        {
            name: 'Risposte aggiuntive',
            price: '€0.25/risposta',
            description: 'Quando superi la soglia mensile'
        },
        {
            name: 'Utenti aggiuntivi',
            price: '€15/utente/mese',
            description: 'Per Pro e Business'
        }
    ],

    yearlyDiscount: {
        percentage: 20,
        badge: '-20% annuale'
    },

    faq: [
        {
            q: 'Posso cambiare piano in qualsiasi momento?',
            a: 'Sì, upgrade immediato con addebito proporzionale. Downgrade dal mese successivo.'
        },
        {
            q: 'Cosa succede se supero le risposte mensili?',
            a: 'Le interviste vanno in pausa. Puoi acquistare risposte extra a €0.25/risposta o fare upgrade.'
        },
        {
            q: 'Le bozze contano come risposte?',
            a: 'No, contiamo solo le interviste completate dai rispondenti.'
        },
        {
            q: 'C\'è un periodo di prova?',
            a: 'Il piano Trial è gratis per sempre. Starter e Pro hanno 14 giorni di prova gratuita.'
        },
        {
            q: 'Devo inserire la carta di credito per provare?',
            a: 'No, il Trial non richiede carta. Per Starter e Pro sì, ma non addebiteremo nulla per 14 giorni.'
        },
        {
            q: 'Come funziona la fatturazione?',
            a: 'Fattura elettronica mensile o annuale. Accettiamo carta, bonifico, SEPA.'
        },
        {
            q: 'I miei dati sono al sicuro?',
            a: 'Sì, crittografia end-to-end, server EU, GDPR compliant. Nessun dato usato per training AI.'
        },
        {
            q: 'Avete piani enterprise?',
            a: 'Sì, per volumi superiori o esigenze particolari contattaci per un preventivo personalizzato.'
        }
    ]
};
