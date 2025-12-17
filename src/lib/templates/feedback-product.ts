import { Template } from './types';

export const feedbackProductTemplate: Template = {
    id: 'feedback-product',
    slug: 'feedback-prodotto',
    name: 'Feedback Prodotto',
    description: 'Capire cosa pensano gli utenti di un prodotto o feature',
    category: 'product',
    icon: '💡',
    defaultConfig: {
        researchGoal: 'Raccogliere feedback qualitativo approfondito su un prodotto o feature per identificare punti di forza, aree di miglioramento e opportunità di sviluppo.',
        targetAudience: 'Utenti attivi del prodotto o feature in esame',
        language: 'it',
        tone: 'Amichevole e curioso',
        maxDurationMins: 10,
        introMessage: 'Ciao! Grazie per dedicarmi qualche minuto. Sono qui per capire meglio la tua esperienza con il nostro prodotto. Non ci sono risposte giuste o sbagliate - ogni tuo feedback è prezioso per aiutarci a migliorare.',
        topics: [
            {
                label: 'Esperienza Generale',
                description: 'Capire come l\'utente utilizza il prodotto quotidianamente',
                subGoals: [
                    'Frequenza di utilizzo',
                    'Contesto di utilizzo (quando, dove, perché)',
                    'Aspettative iniziali vs realtà'
                ],
                maxTurns: 4
            },
            {
                label: 'Punti di Forza',
                description: 'Identificare cosa funziona bene e perché',
                subGoals: [
                    'Feature preferite',
                    'Momenti "wow"',
                    'Problemi risolti efficacemente'
                ],
                maxTurns: 4
            },
            {
                label: 'Aree di Miglioramento',
                description: 'Scoprire frustrazioni e opportunità',
                subGoals: [
                    'Difficoltà incontrate',
                    'Funzionalità mancanti',
                    'Suggerimenti specifici'
                ],
                maxTurns: 4
            }
        ]
    },
    examplePrompt: 'Voglio capire cosa pensano i miei utenti del nostro prodotto'
};
