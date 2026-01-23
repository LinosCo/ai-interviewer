
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
                '100 interviste/mese',
                '3 progetti',
                '1 Assistente Chatbot',
                '500 sessioni chatbot',
                'Analytics completi',
                'Export PDF/CSV',
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
                '400 interviste/mese',
                '10 progetti',
                '3 Assistenti Chatbot',
                '4.000 sessioni chatbot',
                'Brand Monitor (800 query)',
                'AI Tips & suggerimenti',
                'Analytics avanzati',
                'Nessun watermark',
                'Export CSV + Webhook',
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
                '1.000 interviste/mese',
                'Progetti illimitati',
                '10 Assistenti Chatbot',
                '12.000 sessioni chatbot',
                'Brand Monitor (4.000 query)',
                'AI Tips avanzati',
                'API REST + Webhook',
                'Priority Support',
                'Account manager dedicato'
            ]
        }
    ],

    addons: [
        {
            name: 'Interviste aggiuntive',
            price: '€0.25/intervista',
            description: 'Quando superi la soglia mensile'
        },
        {
            name: 'Utenti aggiuntivi',
            price: '€15/utente/mese',
            description: 'Per team con più utenti'
        },
        {
            name: 'Chatbot aggiuntivo',
            price: '€29/mese',
            description: 'Ogni bot oltre il limite del piano'
        },
        {
            name: 'Brand Monitor aggiuntivo',
            price: '€49/mese',
            description: 'Per monitorare brand/competitor extra'
        }
    ],

    yearlyDiscount: {
        percentage: 25,
        badge: '-25% annuale'
    },

    faq: [
        {
            q: 'Posso cambiare piano in qualsiasi momento?',
            a: 'Sì, upgrade immediato con addebito proporzionale. Downgrade dal mese successivo.'
        },
        {
            q: 'Cosa succede se supero le interviste mensili?',
            a: 'Le interviste vanno in pausa. Puoi acquistare interviste extra a €0.25/intervista o fare upgrade.'
        },
        {
            q: 'Quali sono i tre strumenti inclusi?',
            a: 'Interviste Intelligenti per raccogliere feedback, Assistente Chatbot per assistenza 24/7 e gap detection, Brand Monitor per monitorare come i motori AI parlano del tuo brand.'
        },
        {
            q: 'Le bozze contano come interviste?',
            a: 'No, contiamo solo le interviste completate dai rispondenti.'
        },
        {
            q: 'C\'è un periodo di prova?',
            a: 'Sì! 14 giorni gratis con accesso completo a tutte le funzionalità PRO. Nessuna carta richiesta.'
        },
        {
            q: 'Come funziona Brand Monitor?',
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
