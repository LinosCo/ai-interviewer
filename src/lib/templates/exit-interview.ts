import { Template } from './types';

export const exitInterviewTemplate: Template = {
    id: 'exit-interview',
    slug: 'exit-interview',
    name: 'Exit Interview',
    description: 'Raccogliere feedback da chi lascia l\'azienda',
    category: 'hr',
    icon: '👋',
    defaultConfig: {
        researchGoal: 'Comprendere le motivazioni dietro la decisione di lasciare l\'azienda, identificare pattern ricorrenti e raccogliere suggerimenti per migliorare la retention.',
        targetAudience: 'Dipendenti in uscita dall\'azienda',
        language: 'it',
        tone: 'Empatico e rispettoso',
        maxDurationMins: 15,
        introMessage: 'Ciao, prima di tutto grazie per il tempo che ci hai dedicato. Questa conversazione è completamente confidenziale e il tuo feedback sincero ci aiuterà a capire come possiamo migliorare come azienda. Non esitare a condividere anche critiche - sono preziose per noi.',
        topics: [
            {
                label: 'Motivazioni della Decisione',
                description: 'Esplorare i fattori che hanno portato alla decisione di lasciare',
                subGoals: [
                    'Fattore principale della decisione',
                    'Tempistica della decisione',
                    'Cosa avrebbe potuto cambiare la situazione'
                ],
                maxTurns: 5
            },
            {
                label: 'Esperienza in Azienda',
                description: 'Raccogliere feedback sull\'esperienza complessiva',
                subGoals: [
                    'Rapporto con manager e team',
                    'Opportunità di crescita',
                    'Cultura aziendale',
                    'Work-life balance'
                ],
                maxTurns: 5
            },
            {
                label: 'Suggerimenti per il Futuro',
                description: 'Raccogliere idee costruttive per migliorare',
                subGoals: [
                    'Cosa cambierebbe dell\'azienda',
                    'Consigli per chi resta',
                    'Cosa potrebbe far tornare'
                ],
                maxTurns: 4
            }
        ]
    },
    examplePrompt: 'Voglio raccogliere feedback da chi lascia l\'azienda'
};
