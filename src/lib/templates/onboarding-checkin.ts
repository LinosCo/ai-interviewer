import { Template } from './types';

export const onboardingCheckinTemplate: Template = {
    id: 'onboarding-checkin',
    slug: 'onboarding-checkin',
    name: 'Onboarding Check-in',
    description: 'Verificare l\'esperienza dei nuovi assunti',
    category: 'hr',
    icon: '🎯',
    defaultConfig: {
        researchGoal: 'Valutare l\'efficacia del processo di onboarding, identificare gap formativi e raccogliere feedback per migliorare l\'esperienza dei nuovi dipendenti.',
        targetAudience: 'Nuovi assunti a 30/60/90 giorni dall\'ingresso',
        language: 'it',
        tone: 'Supportivo e incoraggiante',
        maxDurationMins: 10,
        introMessage: 'Ciao! Come va il tuo inserimento? Sono qui per capire come sta andando la tua esperienza nei primi tempi in azienda. Il tuo feedback ci aiuterà a migliorare l\'onboarding per i futuri colleghi.',
        topics: [
            {
                label: 'Primo Impatto',
                description: 'Esperienza delle prime settimane',
                subGoals: [
                    'Accoglienza ricevuta',
                    'Chiarezza del ruolo',
                    'Accesso a strumenti e risorse'
                ],
                maxTurns: 4
            },
            {
                label: 'Formazione e Supporto',
                description: 'Valutare l\'efficacia del training',
                subGoals: [
                    'Qualità della formazione ricevuta',
                    'Supporto dal manager e dal team',
                    'Gap formativi percepiti'
                ],
                maxTurns: 4
            },
            {
                label: 'Integrazione e Aspettative',
                description: 'Verificare allineamento con le aspettative',
                subGoals: [
                    'Livello di integrazione nel team',
                    'Aspettative vs realtà',
                    'Suggerimenti per migliorare'
                ],
                maxTurns: 3
            }
        ]
    },
    examplePrompt: 'Voglio verificare come sta andando l\'inserimento dei nuovi assunti'
};
