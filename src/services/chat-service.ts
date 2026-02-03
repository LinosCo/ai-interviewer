
import { prisma } from '@/lib/prisma';
import { checkInterviewStatus, markInterviewAsCompleted } from '@/lib/usage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Conversation, Message, Bot, TopicBlock } from '@prisma/client';

export class ChatService {

    /**
     * Loads the conversation and its associated bot/project data.
     * Throws if not found or unauthorized.
     */
    static async loadConversation(conversationId: string, botId: string) {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                bot: {
                    include: {
                        topics: { orderBy: { orderIndex: 'asc' } },
                        knowledgeSources: true,
                        rewardConfig: true,
                        project: {
                            include: {
                                organization: true
                            }
                        }
                    }
                }
            }
        });

        if (!conversation || conversation.botId !== botId) {
            throw new Error("Unauthorized or Not Found");
        }

        return conversation;
    }

    /**
     * Saves a user message to the database.
     */
    static async saveUserMessage(conversationId: string, content: string) {
        return await prisma.message.create({
            data: {
                conversationId,
                role: 'user',
                content
            }
        });
    }

    /**
     * Saves an assistant message to the database.
     */
    static async saveAssistantMessage(conversationId: string, content: string) {
        return await prisma.message.create({
            data: {
                conversationId,
                role: 'assistant',
                content
            }
        });
    }

    /**
     * Updates the conversation's effective duration and exchange count.
     */
    static async updateProgress(conversationId: string, durationSeconds: number) {
        return await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                effectiveDuration: durationSeconds,
                exchangeCount: { increment: 1 }
            }
        });
    }

    /**
     * Updates the current active topic.
     */
    static async updateCurrentTopic(conversationId: string, topicId: string) {
        return await prisma.conversation.update({
            where: { id: conversationId },
            data: { currentTopicId: topicId }
        });
    }

    /**
     * Checks if the interview limits (time/turns) have been reached.
     */
    static async checkLimits(conversationId: string) {
        return await checkInterviewStatus(conversationId);
    }

    /**
     * Marks the interview as completed.
     */
    static async completeInterview(conversationId: string) {
        return await markInterviewAsCompleted(conversationId);
    }
}
