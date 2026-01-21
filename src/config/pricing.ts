
export const PRICING_PAGE = {
    headline: "Scegli il piano giusto per te",
    subheadline: "Inizia gratis, scala quando serve. Nessun vincolo.",

    plans: [
        {
            id: 'starter',
            name: 'Starter',
            price: '€69',
            period: '/mese',
            description: 'Per il professionista',
            cta: 'Inizia 14 giorni gratis',
            highlighted: false,
            features: [
                '5 AI Interviews attive',
                '300 risposte/mese',
                '1 Chatbot Intelligence',
                '2.000 conversazioni chatbot',
                'Analytics base',
                'Logo custom',
                '2 utenti inclusi',
                'Supporto email'
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '€199',
            period: '/mese',
            description: 'Per la PMI',
            cta: 'Inizia 14 giorni gratis',
            highlighted: true,
            badge: '⭐ Più popolare',
            features: [
                '15 AI Interviews attive',
                '1.000 risposte/mese',
                '3 Chatbot Intelligence',
                '10.000 conversazioni chatbot',
                '1 Visibility Tracker',
                '50 Cross-Channel insights',
                'Analytics avanzati',
                'Nessun watermark',
                'Export CSV + Webhook',
                '5 utenti inclusi',
                'Supporto prioritario'
            ]
        },
        {
            id: 'business',
            name: 'Business',
            price: '€399',
            period: '/mese',
            description: 'Per l\'azienda strutturata',
            cta: 'Contattaci',
            highlighted: false,
            features: [
                'AI Interviews illimitate',
                '3.000 risposte/mese',
                '10 Chatbot Intelligence',
                '30.000 conversazioni chatbot',
                '3 Visibility Tracker',
                'Visibility giornaliera',
                'Cross-Channel illimitato',
                'White label completo',
                'Dominio personalizzato',
                'API REST + Webhook',
                '15 utenti inclusi',
                'Account manager dedicato'
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
        },
        {
            name: 'Chatbot aggiuntivo',
            price: '€29/mese',
            description: 'Ogni bot oltre il limite del piano'
        },
        {
            name: 'Visibility Tracker aggiuntivo',
            price: '€49/mese',
            description: 'Per monitorare brand/competitor extra'
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
            q: 'Quali sono i tre strumenti inclusi?',
            a: 'AI Interviews per raccogliere feedback, Chatbot Intelligence per assistenza 24/7 e gap detection, Visibility Tracker per monitorare come i motori AI parlano del tuo brand.'
        },
        {
            q: 'Le bozze contano come risposte?',
            a: 'No, contiamo solo le interviste completate dai rispondenti.'
        },
        {
            q: 'C\'è un periodo di prova?',
            a: 'Sì! 14 giorni gratis con accesso completo a tutte le funzionalità PRO. Nessuna carta richiesta.'
        },
        {
            q: 'Come funziona il Visibility Tracker?',
            a: 'Monitoriamo come ChatGPT, Perplexity e altri motori AI rispondono alle domande sul tuo settore. Ricevi alert quando vieni menzionato o quando la percezione cambia.'
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
