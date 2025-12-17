// Template type definitions for Business Tuner

export interface Template {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: 'hr' | 'product' | 'sales' | 'operations' | 'strategy';
    icon: string;
    defaultConfig: {
        researchGoal: string;
        targetAudience: string;
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
    examplePrompt: string;
}
