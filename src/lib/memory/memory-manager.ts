import { prisma } from '@/lib/prisma';
import { extractFactsFromResponse } from './fact-extractor';
import {
    ConversationMemoryData,
    CollectedFact,
    ExploredTopic,
    UnansweredArea
} from '@/types/memory';
import { v4 as uuidv4 } from 'uuid';

export class MemoryManager {

    /**
     * Inizializza la memoria per una nuova conversazione
     */
    static async initialize(conversationId: string): Promise<void> {
        await prisma.conversationMemory.create({
            data: {
                conversationId,
                factsCollected: [],
                topicsExplored: [],
                unansweredAreas: []
            }
        });
    }

    /**
     * Recupera la memoria esistente
     */
    static async get(conversationId: string): Promise<ConversationMemoryData | null> {
        const memory = await prisma.conversationMemory.findUnique({
            where: { conversationId }
        });

        if (!memory) return null;

        return {
            factsCollected: memory.factsCollected as CollectedFact[],
            topicsExplored: memory.topicsExplored as ExploredTopic[],
            unansweredAreas: memory.unansweredAreas as UnansweredArea[],
            userFatigueScore: memory.userFatigueScore,
            detectedTone: memory.detectedTone as ConversationMemoryData['detectedTone'],
            avgResponseLength: memory.avgResponseLength,
            usesEmoji: memory.usesEmoji
        };
    }

    /**
     * Aggiorna la memoria dopo una risposta utente
     */
    static async updateAfterUserResponse(
        conversationId: string,
        userMessage: string,
        currentTopicId: string,
        currentTopicLabel: string,
        apiKey: string
    ): Promise<ConversationMemoryData> {

        // 1. Recupera memoria esistente
        let memory = await this.get(conversationId);
        if (!memory) {
            await this.initialize(conversationId);
            memory = await this.get(conversationId);
        }

        // 2. Estrai nuovi fatti
        const extraction = await extractFactsFromResponse(
            userMessage,
            currentTopicLabel,
            memory!.factsCollected,
            apiKey
        );

        // 3. Aggiungi nuovi fatti
        const newFacts: CollectedFact[] = extraction.newFacts.map(f => ({
            ...f,
            id: uuidv4(),
            extractedAt: new Date().toISOString()
        }));

        const updatedFacts = [...memory!.factsCollected, ...newFacts];

        // 4. Aggiorna statistiche tono
        const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(userMessage);
        const messageLength = userMessage.length;
        const currentAvg = memory!.avgResponseLength;
        const messageCount = memory!.factsCollected.length + 1;
        const newAvg = Math.round((currentAvg * (messageCount - 1) + messageLength) / messageCount);

        // 5. Aggiorna fatica (media mobile)
        const newFatigueScore = (memory!.userFatigueScore * 0.7) + (extraction.fatigueScore * 0.3);

        // 6. Salva
        await prisma.conversationMemory.update({
            where: { conversationId },
            data: {
                factsCollected: updatedFacts as any, // Cast to any for Prisma JSON
                userFatigueScore: newFatigueScore,
                detectedTone: (extraction.detectedTone || memory!.detectedTone) as ConversationMemoryData['detectedTone'],
                avgResponseLength: newAvg,
                usesEmoji: memory!.usesEmoji || hasEmoji
            }
        });

        return {
            ...memory!,
            factsCollected: updatedFacts,
            userFatigueScore: newFatigueScore,
            detectedTone: extraction.detectedTone || memory!.detectedTone,
            avgResponseLength: newAvg,
            usesEmoji: memory!.usesEmoji || hasEmoji
        };
    }

    /**
     * Marca un topic come esplorato
     */
    static async markTopicExplored(
        conversationId: string,
        topicId: string,
        topicLabel: string,
        coverageLevel: 'shallow' | 'moderate' | 'deep',
        subGoalsCovered: string[],
        subGoalsMissing: string[]
    ): Promise<void> {

        const memory = await this.get(conversationId);
        if (!memory) return;

        const existingIndex = memory.topicsExplored.findIndex(t => t.topicId === topicId);

        const exploredTopic: ExploredTopic = {
            topicId,
            topicLabel,
            coverageLevel,
            subGoalsCovered,
            subGoalsMissing,
            lastExploredAt: new Date().toISOString()
        };

        let updatedTopics: ExploredTopic[];
        if (existingIndex >= 0) {
            updatedTopics = [...memory.topicsExplored];
            updatedTopics[existingIndex] = exploredTopic;
        } else {
            updatedTopics = [...memory.topicsExplored, exploredTopic];
        }

        await prisma.conversationMemory.update({
            where: { conversationId },
            data: { topicsExplored: updatedTopics as any }
        });
    }

    /**
     * Genera il contesto memoria per il prompt
     */
    static formatForPrompt(memory: ConversationMemoryData): string {
        const sections: string[] = [];

        // Fatti raccolti
        if (memory.factsCollected.length > 0) {
            const factsText = memory.factsCollected
                .filter(f => f.confidence >= 0.6)
                .map(f => `• ${f.content}`)
                .join('\n');

            sections.push(`## INFORMAZIONI GIÀ RACCOLTE
${factsText}

⚠️ NON chiedere nuovamente informazioni su questi temi. Se devi approfondire, parti da quello che già sai.`);
        }

        // Topic esplorati
        if (memory.topicsExplored.length > 0) {
            const topicsText = memory.topicsExplored
                .map(t => `• ${t.topicLabel}: ${t.coverageLevel} (coperti: ${t.subGoalsCovered.join(', ') || 'nessuno'})`)
                .join('\n');

            sections.push(`## TOPIC GIÀ DISCUSSI
${topicsText}`);
        }

        // Segnali fatica
        if (memory.userFatigueScore > 0.5) {
            sections.push(`## ⚠️ ATTENZIONE: SEGNALI DI FATICA
L'utente mostra segni di stanchezza (score: ${memory.userFatigueScore.toFixed(2)}).
- Fai domande più brevi e dirette
- Considera di saltare approfondimenti non essenziali
- Valuta se concludere prima del previsto`);
        }

        // Stile comunicativo
        if (memory.detectedTone) {
            const toneInstructions: Record<string, string> = {
                formal: 'Mantieni un registro formale e professionale.',
                casual: 'Usa un tono colloquiale e amichevole.',
                brief: 'L\'utente preferisce risposte brevi. Fai domande concise e dirette.',
                verbose: 'L\'utente è loquace. Puoi permetterti domande più articolate.'
            };

            sections.push(`## STILE COMUNICATIVO RILEVATO
${toneInstructions[memory.detectedTone] || ''}
${memory.usesEmoji ? 'L\'utente usa emoji, puoi usarle occasionalmente.' : ''}`);
        }

        return sections.join('\n\n');
    }
}
