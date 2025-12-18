export interface CollectedFact {
    id: string;
    content: string;           // "L'utente è a Verona per una vacanza romantica"
    topic: string;             // ID del topic di riferimento
    extractedAt: string;       // ISO timestamp
    confidence: number;        // 0-1, quanto siamo sicuri dell'estrazione
    keywords: string[];        // ["Verona", "vacanza", "romantica"]
}

export interface ExploredTopic {
    topicId: string;
    topicLabel: string;
    coverageLevel: 'shallow' | 'moderate' | 'deep';
    subGoalsCovered: string[];
    subGoalsMissing: string[];
    lastExploredAt: string;
}

export interface UnansweredArea {
    area: string;              // "budget del viaggio"
    priority: 'high' | 'medium' | 'low';
    attempts: number;          // Quante volte abbiamo provato a chiedere
    skipReason?: string;       // "user_declined" | "off_topic" | "time_limit"
}

export interface ConversationMemoryData {
    factsCollected: CollectedFact[];
    topicsExplored: ExploredTopic[];
    unansweredAreas: UnansweredArea[];
    userFatigueScore: number;
    detectedTone: 'formal' | 'casual' | 'brief' | 'verbose' | null;
    avgResponseLength: number;
    usesEmoji: boolean;
}
