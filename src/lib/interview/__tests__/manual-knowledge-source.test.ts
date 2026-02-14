import { describe, expect, it } from 'vitest';
import {
    buildAutoInterviewKnowledgeContent,
    getInterviewGuideTitle
} from '@/lib/interview/manual-knowledge-source';

describe('manual-knowledge-source', () => {
    it('builds italian auto knowledge with goal, audience and topic sections', () => {
        const content = buildAutoInterviewKnowledgeContent({
            language: 'it',
            botName: 'Esploratori AI',
            researchGoal: 'Capire come le PMI usano l’AI in marketing e vendite',
            targetAudience: 'Imprenditori e responsabili commerciali',
            topics: [
                {
                    label: 'Contesto aziendale',
                    description: 'Dimensione, settore e mercato di riferimento',
                    subGoals: ['Settore', 'Mercato geografico']
                },
                {
                    label: 'Uso dell’AI',
                    description: 'Adozione attuale e aspettative',
                    subGoals: ['Aspettative', 'Esperienze pregresse']
                }
            ]
        });

        expect(content).toContain('Obiettivo di ricerca');
        expect(content).toContain('Target intervistati');
        expect(content).toContain('Topic 1 - Contesto aziendale');
        expect(content).toContain('Topic 2 - Uso dell’AI');
        expect(content).toContain('Follow-up suggeriti');
    });

    it('returns default title for interview guide source', () => {
        expect(getInterviewGuideTitle('it')).toBe('Interview Knowledge (Auto)');
        expect(getInterviewGuideTitle('en')).toBe('Interview Knowledge (Auto)');
    });
});
