import { Template } from './types';

export const conceptTestingTemplate: Template = {
    id: 'concept-testing',
    slug: 'concept-testing',
    name: 'Concept Testing',
    description: 'Validare un\'idea prima di svilupparla',
    category: 'product',
    icon: '🧪',
    defaultConfig: {
        researchGoal: 'Validare un concetto o idea di prodotto con potenziali utenti, raccogliere feedback sulla value proposition e identificare obiezioni o dubbi prima dello sviluppo.',
        targetAudience: 'Potenziali utenti del prodotto/servizio in valutazione',
        language: 'it',
        tone: 'Curioso e neutrale',
        maxDurationMins: 12,
        introMessage: 'Ciao! Stiamo esplorando una nuova idea e il tuo parere è fondamentale. Non esiste una risposta giusta - vogliamo capire la tua reazione spontanea. Sentiti libero di essere anche critico, è esattamente quello che ci serve.',
        topics: [
            {
                label: 'Contesto e Problema',
                description: 'Esplorare l\'esperienza attuale dell\'utente',
                subGoals: [
                    'Come affronta oggi il problema',
                    'Livello di frustrazione attuale',
                    'Soluzioni alternative provate'
                ],
                maxTurns: 4
            },
            {
                label: 'Reazione al Concept',
                description: 'Raccogliere la prima reazione all\'idea',
                subGoals: [
                    'Prima impressione spontanea',
                    'Cosa piace di più',
                    'Cosa piace di meno o preoccupa'
                ],
                maxTurns: 4
            },
            {
                label: 'Intent e Valore',
                description: 'Valutare il potenziale interesse reale',
                subGoals: [
                    'Probabilità di utilizzo/acquisto',
                    'Quanto pagherebbe',
                    'A chi lo consiglierebbe'
                ],
                maxTurns: 4
            }
        ]
    },
    examplePrompt: 'Voglio validare una nuova idea di prodotto con potenziali utenti'
};
