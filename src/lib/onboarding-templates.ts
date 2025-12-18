export interface Template {
    id: string;
    name: string;
    description: string;
    researchGoal: string;
    targetAudience: string;
    category: 'Product' | 'HR' | 'Customer Success' | 'Business';
    icon: string;
    defaultConfig: {
        language: string;
        tone: string;
        maxDurationMins: number;
        introMessage: string;
        topics: {
            label: string;
            description: string;
            subGoals: string[];
            maxTurns: number;
        }[];
    };
}

export const TEMPLATES: Template[] = [
    {
        id: 'churn-analysis',
        name: 'Analisi Abbandono (Churn)',
        category: 'Customer Success',
        icon: 'UserMinus',
        description: 'Capisci le reali motivazioni dietro la cancellazione di un abbonamento o servizio.',
        researchGoal: 'Identificare i punti di attrito principali e le mancanze del prodotto che portano l\'utente a cancellare l\'abbonamento, distinguendo tra problemi tecnici, di prezzo o di valore percepito.',
        targetAudience: 'Utenti che hanno appena richiesto la cancellazione o che non hanno rinnovato negli ultimi 30 giorni.',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Empatico ma professionale',
            maxDurationMins: 5,
            introMessage: 'Ciao, mi dispiace che tu stia lasciando il nostro servizio. Vorrei farti qualche domanda per capire come avremmo potuto fare meglio.',
            topics: [
                { label: 'Motivazione principale', description: 'Perché l\'utente sta cancellando.', subGoals: ['Identificare il "trigger" della cancellazione', 'Capire se è un problema di prezzo'], maxTurns: 3 },
                { label: 'Esperienza Prodotto', description: 'Feedback sulle funzionalità.', subGoals: ['Punti di forza e debolezza', 'Funzionalità mancanti'], maxTurns: 3 }
            ]
        }
    },
    {
        id: 'employee-engagement',
        name: 'Clima Aziendale e Feedback',
        category: 'HR',
        icon: 'Users',
        description: 'Misura il benessere del team e raccogli suggerimenti onesti sulla cultura aziendale.',
        researchGoal: 'Valutare il livello di soddisfazione dei dipendenti riguardo alla comunicazione interna, al work-life balance e alle opportunità di crescita, garantendo l\'anonimato per ottenere feedback sinceri.',
        targetAudience: 'Tutti i dipendenti dell\'azienda o di un dipartimento specifico.',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Amichevole e inclusivo',
            maxDurationMins: 8,
            introMessage: 'Ciao! Il tuo parere è fondamentale per migliorare il nostro ambiente di lavoro. Questa conversazione è completamente anonima.',
            topics: [
                { label: 'Benessere e Cultura', description: 'Soddisfazione generale.', subGoals: ['Work-life balance', 'Sentirsi parte del team'], maxTurns: 4 },
                { label: 'Management e Crescita', description: 'Rapporto con i responsabili.', subGoals: ['Qualità del feedback ricevuto', 'Opportunità di carriera'], maxTurns: 4 }
            ]
        }
    },
    {
        id: 'new-feature-validation',
        name: 'Validazione Nuova Feature',
        category: 'Product',
        icon: 'Sparkles',
        description: 'Testa un\'idea o un prototipo prima di investire mesi nello sviluppo.',
        researchGoal: 'Validare il bisogno reale per una nuova funzionalità ipotizzata, capendo se risolve un problema sentito e quanto l\'utente sarebbe disposto ad usarla o pagarla.',
        targetAudience: 'Early adopters o power users del prodotto attuale.',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Incuriosito e propositivo',
            maxDurationMins: 6,
            introMessage: 'Ciao! Stiamo pensando di lanciare una nuova funzionalità e vorremmo sapere cosa ne pensi. Ci aiuti a progettarla?',
            topics: [
                { label: 'Assetto del Problema', description: 'Il dolore che vogliamo risolvere.', subGoals: ['Come risolvono il problema oggi', 'Frustrazioni attuali'], maxTurns: 3 },
                { label: 'Valore e Utilizzo', description: 'Reazione alla proposta.', subGoals: ['Frequenza d\'uso ipotizzata', 'Disponibilità a pagare'], maxTurns: 4 }
            ]
        }
    },
    {
        id: 'win-loss-analysis',
        name: 'Win/Loss Analysis Sales',
        category: 'Business',
        icon: 'Target',
        description: 'Perché hai perso (o vinto) quel deal? Ottieni la verità direttamente dal buyer.',
        researchGoal: 'Capire i fattori decisivi nel processo d\'acquisto di un prospect, analizzando la percezione del brand, del prezzo e del prodotto rispetto alla concorrenza.',
        targetAudience: 'Decision maker di aziende che hanno appena concluso un processo di vendita (vinto o perso).',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Professionale e rispettoso',
            maxDurationMins: 7,
            introMessage: 'Ciao, ti ringrazio per il tempo dedicato al nostro processo commerciale. Vorrei capire meglio i fattori che hanno guidato la tua scelta finale.',
            topics: [
                { label: 'Processo Decisionale', description: 'Chi e come ha scelto.', subGoals: ['Driver principali della scelta', 'Percezione del valore'], maxTurns: 4 },
                { label: 'Confronto Competitivo', description: 'Perché noi o loro.', subGoals: ['Punti di forza dei competitor', 'Dove abbiamo (o hanno) fatto la differenza'], maxTurns: 3 }
            ]
        }
    },
    {
        id: 'customer-onboarding-feedback',
        name: 'Feedback Onboarding',
        category: 'Customer Success',
        icon: 'Rocket',
        description: 'Ottimizza i primi 15 minuti di esperienza dell\'utente con il tuo prodotto.',
        researchGoal: 'Individuare ostacoli e momenti di "Aha!" durante i primi passi dell\'utente nel prodotto per aumentare il tasso di attivazione.',
        targetAudience: 'Nuovi utenti che hanno completato l\'iscrizione nelle ultime 24-48 ore.',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Accogliente e d\'aiuto',
            maxDurationMins: 4,
            introMessage: 'Benvenuto! Spero che i tuoi primi momenti con noi siano stati positivi. Come è andata l\'attivazione del tuo account?',
            topics: [
                { label: 'Primi Passi', description: 'Semplicità della configurazione.', subGoals: ['Ostacoli riscontrati', 'Chiarezza delle istruzioni'], maxTurns: 3 },
                { label: 'Prime Impressioni', description: 'Valore immediato.', subGoals: ['Aspettative vs Realtà', 'Momento di comprensione del valore'], maxTurns: 3 }
            ]
        }
    },
    {
        id: 'brand-perception',
        name: 'Percezione del Brand',
        category: 'Business',
        icon: 'Search',
        description: 'Cosa dicono di te quando non sei nella stanza? Scopri il tuo vero posizionamento.',
        researchGoal: 'Mappare gli attributi emotivi e razionali associati al brand dal target di riferimento, identificando scostamenti tra identità voluta e percepita.',
        targetAudience: 'Clienti attuali, potenziali o stakeholder del settore.',
        defaultConfig: {
            language: 'Italiano',
            tone: 'Neutrale e aperto',
            maxDurationMins: 6,
            introMessage: 'Ciao, stiamo analizzando come la nostra azienda viene percepita all\'esterno. La tua opinione sincera ci aiuterà a crescere.',
            topics: [
                { label: 'Identità e Valori', description: 'Associazioni mentali.', subGoals: ['Parole chiave associate al brand', 'Affidabilità percepita'], maxTurns: 4 },
                { label: 'Posizionamento', description: 'Confronto con il mercato.', subGoals: ['Cosa ci rende unici', 'In cosa dovremmo migliorare'], maxTurns: 3 }
            ]
        }
    }
];

export function getTemplateById(id: string): Template | undefined {
    return TEMPLATES.find(t => t.id === id);
}

// Per compatibilità con codici meno recenti
export function getTemplateBySlug(slug: string): Template | undefined {
    return getTemplateById(slug);
}
