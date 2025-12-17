import { Template } from './types';

export const customerChurnTemplate: Template = {
    id: 'customer-churn',
    slug: 'customer-churn',
    name: 'Customer Churn Analysis',
    description: 'Capire perché i clienti se ne vanno',
    category: 'sales',
    icon: '📉',
    defaultConfig: {
        researchGoal: 'Identificare le cause di abbandono dei clienti, comprendere il loro journey e scoprire interventi che avrebbero potuto prevenire la cancellazione.',
        targetAudience: 'Clienti che hanno recentemente cancellato o stanno per cancellare',
        language: 'it',
        tone: 'Comprensivo e non difensivo',
        maxDurationMins: 10,
        introMessage: 'Ciao! Grazie per aver accettato di parlarmi. Capisco che tu abbia deciso di non continuare con noi, e rispetto pienamente la tua scelta. Vorrei solo capire meglio la tua esperienza per aiutarci a migliorare. Ogni feedback, anche critico, è benvenuto.',
        topics: [
            {
                label: 'Motivo dell\'Abbandono',
                description: 'Capire la causa principale della cancellazione',
                subGoals: [
                    'Fattore scatenante finale',
                    'Segnali premonitori o frustrazioni accumulate',
                    'Aspettative non soddisfatte'
                ],
                maxTurns: 4
            },
            {
                label: 'Esperienza con il Prodotto',
                description: 'Valutare l\'esperienza complessiva',
                subGoals: [
                    'Cosa funzionava bene',
                    'Cosa non funzionava',
                    'Confronto con alternative'
                ],
                maxTurns: 4
            },
            {
                label: 'Opportunità di Recupero',
                description: 'Esplorare possibilità di retention',
                subGoals: [
                    'Cosa avrebbe potuto cambiare la decisione',
                    'Condizioni per un eventuale ritorno',
                    'Suggerimenti per altri clienti'
                ],
                maxTurns: 3
            }
        ]
    },
    examplePrompt: 'Voglio capire perché i clienti cancellano'
};
