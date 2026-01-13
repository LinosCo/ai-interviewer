import { Bot, ShoppingBag, Headphones, Target, Rocket } from 'lucide-react';

export interface ChatbotTemplate {
    id: string;
    name: string;
    description: string;
    icon: any;
    config: {
        tone: string;
        introMessage: string;
        fallbackMessage: string;
        leadCaptureStrategy: string;
        candidateDataFields: Array<{ field: string; question: string; required: boolean }>;
        topics: string[];
        boundaries: string[];
        primaryColor: string;
    };
}

export const CHATBOT_TEMPLATES: ChatbotTemplate[] = [
    {
        id: 'customer-support',
        name: 'Supporto Clienti',
        description: 'Assistenza automatica 24/7 per rispondere alle domande frequenti.',
        icon: Headphones,
        config: {
            tone: 'Professionale, Empatico e Paziente',
            introMessage: 'Ciao! 👋 Sono l\'assistente virtuale del supporto clienti. Come posso aiutarti oggi?',
            fallbackMessage: 'Mi dispiace, non ho trovato una risposta a questa domanda specifica. Vuoi che ti metta in contatto con un operatore umano?',
            leadCaptureStrategy: 'on_exit',
            candidateDataFields: [
                { field: 'name', question: 'Come posso chiamarti?', required: true },
                { field: 'email', question: 'A quale email possiamo inviarti la risposta?', required: true }
            ],
            topics: ['Spedizioni', 'Resi e Rimborsi', 'Stato Ordine', 'Informazioni Prodotto', 'Problemi Tecnici'],
            boundaries: ['Non fornire consulenza legale', 'Non promettere rimborsi fuori policy'],
            primaryColor: '#2563EB' // Blue
        }
    },
    {
        id: 'sales-qualifier',
        name: 'Sales Assistant',
        description: 'Qualifica i lead e guida gli utenti verso l\'acquisto.',
        icon: Target,
        config: {
            tone: 'Energico, Persuasivo e Diretto',
            introMessage: 'Benvenuto! 🚀 Sto aiutando molte aziende a crescere. Tu cosa stai cercando di ottenere?',
            fallbackMessage: 'Interessante! Per darti la risposta migliore, avrei bisogno di capire meglio le tue esigenze. Ti va di parlarne con un nostro esperto?',
            leadCaptureStrategy: 'after_3_msgs',
            candidateDataFields: [
                { field: 'name', question: 'Come ti chiami?', required: true },
                { field: 'company', question: 'Per quale azienda lavori?', required: true },
                { field: 'role', question: 'Qual è il tuo ruolo?', required: false },
                { field: 'email', question: 'Qual è la tua email aziendale?', required: true }
            ],
            topics: ['Prezzi', 'Funzionalità', 'Demo', 'Casi Studio', 'Integrazioni'],
            boundaries: ['Non dare sconti non approvati', 'Non parlare dei competitor in modo negativo'],
            primaryColor: '#EA580C' // Orange
        }
    },
    {
        id: 'e-commerce',
        name: 'E-commerce Guide',
        description: 'Aiuta i clienti a trovare il prodotto perfetto.',
        icon: ShoppingBag,
        config: {
            tone: 'Amichevole, Trendy e Utile',
            introMessage: 'Ehi! 👋 Cerchi qualcosa di speciale o stai solo dando un\'occhiata?',
            fallbackMessage: 'Mmm, non sono sicuro di aver capito. Prova a chiedermi di una categoria specifica o descrivi cosa ti piace!',
            leadCaptureStrategy: 'smart',
            candidateDataFields: [
                { field: 'name', question: 'Come ti chiami?', required: false },
                { field: 'email', question: 'Vuoi ricevere offerte esclusive via email?', required: true }
            ],
            topics: ['Consigli Regalo', 'Taglie e Misure', 'Nuovi Arrivi', 'Promozioni', 'Materiali'],
            boundaries: ['Non inventare disponibilità prodotti'],
            primaryColor: '#DB2777' // Pink
        }
    },
    {
        id: 'onboarding',
        name: 'Onboarding Coach',
        description: 'Guida i nuovi utenti alla scoperta della piattaforma.',
        icon: Rocket,
        config: {
            tone: 'Incoraggiante, Chiaro e Ispiratore',
            introMessage: 'Benvenuto a bordo! 🌟 Sei pronto a configurare il tuo account? Chiedimi pure da dove iniziare.',
            fallbackMessage: 'Ottima domanda. Per i dettagli tecnici più complessi, ti consiglio di consultare la nostra documentazione completa o contattare il supporto tecnico.',
            leadCaptureStrategy: 'on_exit',
            candidateDataFields: [
                { field: 'name', question: 'Come ti chiami?', required: true }
            ],
            topics: ['Primo Accesso', 'Configurazione Profilo', 'Tour Guidato', 'Funzionalità Base', 'Sicurezza'],
            boundaries: [],
            primaryColor: '#16A34A' // Green
        }
    },
    {
        id: 'general-assistant',
        name: 'Assistente Generico',
        description: 'Un bot versatile per ogni esigenza.',
        icon: Bot,
        config: {
            tone: 'Neutro, Cortese e Informato',
            introMessage: 'Salve. Sono l\'assistente virtuale. Come posso esserle utile oggi?',
            fallbackMessage: 'Non ho questa informazione al momento. Posso aiutarla con qualcos\'altro?',
            leadCaptureStrategy: 'after_3_msgs',
            candidateDataFields: [
                { field: 'email', question: 'Lasciami la tua email per ricontattarti.', required: true }
            ],
            topics: ['Chi Siamo', 'Contatti', 'Orari', 'Servizi'],
            boundaries: [],
            primaryColor: '#7C3AED' // Purple
        }
    }
];
