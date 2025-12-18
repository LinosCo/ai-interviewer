export interface Template {
    id: string;
    name: string;
    description: string;
    researchGoal: string;
    targetAudience: string;
    category: 'Product' | 'HR' | 'Customer Success' | 'Business';
    icon: string;
    topics: { label: string; orderIndex: number }[];
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
        topics: [
            { label: 'Motivazione principale della scelta', orderIndex: 0 },
            { label: 'Esperienza con le funzionalità chiave', orderIndex: 1 },
            { label: 'Rapporto qualità-prezzo', orderIndex: 2 },
            { label: 'Alternative considerate', orderIndex: 3 },
            { label: 'Cosa avremmo potuto fare diversamente', orderIndex: 4 }
        ]
    },
    {
        id: 'employee-engagement',
        name: 'Clima Aziendale e Feedback',
        category: 'HR',
        icon: 'Users',
        description: 'Misura il benessere del team e raccogli suggerimenti onesti sulla cultura aziendale.',
        researchGoal: 'Valutare il livello di soddisfazione dei dipendenti riguardo alla comunicazione interna, al work-life balance e alle opportunità di crescita, garantendo l\'anonimato per ottenere feedback sinceri.',
        targetAudience: 'Tutti i dipendenti dell\'azienda o di un dipartimento specifico.',
        topics: [
            { label: 'Soddisfazione generale nel ruolo', orderIndex: 0 },
            { label: 'Qualità della comunicazione interna', orderIndex: 1 },
            { label: 'Equilibrio vita-lavoro', orderIndex: 2 },
            { label: 'Supporto dei manager', orderIndex: 3 },
            { label: 'Proposte di miglioramento', orderIndex: 4 }
        ]
    },
    {
        id: 'new-feature-validation',
        name: 'Validazione Nuova Feature',
        category: 'Product',
        icon: 'Sparkles',
        description: 'Testa un\'idea o un prototipo prima di investire mesi nello sviluppo.',
        researchGoal: 'Validare il bisogno reale per una nuova funzionalità ipotizzata, capendo se risolve un problema sentito e quanto l\'utente sarebbe disposto ad usarla o pagarla.',
        targetAudience: 'Early adopters o power users del prodotto attuale.',
        topics: [
            { label: 'Problema attuale e workaround', orderIndex: 0 },
            { label: 'Reazione alla proposta della feature', orderIndex: 1 },
            { label: 'Casi d\'uso ipotizzati', orderIndex: 2 },
            { label: 'Valore percepito e importanza', orderIndex: 3 },
            { label: 'Suggerimenti per il design', orderIndex: 4 }
        ]
    },
    {
        id: 'win-loss-analysis',
        name: 'Win/Loss Analysis Sales',
        category: 'Business',
        icon: 'Target',
        description: 'Perché hai perso (o vinto) quel deal? Ottieni la verità direttamente dal buyer.',
        researchGoal: 'Capire i fattori decisivi nel processo d\'acquisto di un prospect, analizzando la percezione del brand, del prezzo e del prodotto rispetto alla concorrenza.',
        targetAudience: 'Decision maker di aziende che hanno appena concluso un processo di vendita (vinto o perso).',
        topics: [
            { label: 'Il problema che cercavi di risolvere', orderIndex: 0 },
            { label: 'Percezione della nostra soluzione', orderIndex: 1 },
            { label: 'Confronto con i competitor', orderIndex: 2 },
            { label: 'Esperienza con il team vendite', orderIndex: 3 },
            { label: 'Fattore determinante per la scelta', orderIndex: 4 }
        ]
    },
    {
        id: 'customer-onboarding-feedback',
        name: 'Feedback Onboarding',
        category: 'Customer Success',
        icon: 'Rocket',
        description: 'Ottimizza i primi 15 minuti di esperienza dell\'utente con il tuo prodotto.',
        researchGoal: 'Individuare ostacoli e momenti di "Aha!" durante i primi passi dell\'utente nel prodotto per aumentare il tasso di attivazione.',
        targetAudience: 'Nuovi utenti che hanno completato l\'iscrizione nelle ultime 24-48 ore.',
        topics: [
            { label: 'Aspettative iniziali', orderIndex: 0 },
            { label: 'Facilità dei primi step', orderIndex: 1 },
            { label: 'Efficacia di guide e tutorial', orderIndex: 2 },
            { label: 'Eventuali momenti di confusione', orderIndex: 3 },
            { label: 'Suggerimenti per il benvenuto', orderIndex: 4 }
        ]
    },
    {
        id: 'brand-perception',
        name: 'Percezione del Brand',
        category: 'Business',
        icon: 'Search',
        description: 'Cosa dicono di te quando non sei nella stanza? Scopri il tuo vero posizionamento.',
        researchGoal: 'Mappare gli attributi emotivi e razionali associati al brand dal target di riferimento, identificando scostamenti tra identità voluta e percepita.',
        targetAudience: 'Clienti attuali, potenziali o stakeholder del settore.',
        topics: [
            { label: 'Associazioni spontanee col brand', orderIndex: 0 },
            { label: 'Valori percepiti dell\'azienda', orderIndex: 1 },
            { label: 'Posizionamento rispetto ai leader', orderIndex: 2 },
            { label: 'Affidabilità e tono di voce', orderIndex: 3 },
            { label: 'Cosa rende il brand unico', orderIndex: 4 }
        ]
    }
];
