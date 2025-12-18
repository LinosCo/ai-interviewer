import { prisma as db } from '@/lib/prisma';
import { planService } from './planService';
import { notificationService } from './notificationService';

export class InterviewService {

    /**
     * Check if organization has reached response limit and pause interviews if needed
     */
    async checkAndPauseIfNeeded(orgId: string): Promise<void> {
        const limitCheck = await planService.checkResponseLimit(orgId);

        if (!limitCheck.allowed) {
            // Pause all active interviews
            const pausedBots = await db.bot.updateMany({
                where: {
                    project: {
                        organizationId: orgId
                    },
                    status: 'PUBLISHED'
                },
                data: {
                    status: 'PAUSED'
                }
            });

            console.log(`⏸️  Paused ${pausedBots.count} interviews for org ${orgId}`);

            // Notify the organization
            await notificationService.notifyResponseLimitReached(orgId);
        }
    }

    /**
     * Get interview for respondent with limit checks
     */
    async getInterviewForRespondent(
        botId: string
    ): Promise<{ bot?: any; error?: { code: string; message: string } }> {
        const bot = await db.bot.findUnique({
            where: { id: botId },
            include: {
                project: {
                    include: {
                        organization: true
                    }
                }
            }
        });

        if (!bot) {
            return {
                error: {
                    code: 'NOT_FOUND',
                    message: 'Interview not found'
                }
            };
        }

        if (bot.status === 'PAUSED') {
            return {
                error: {
                    code: 'INTERVIEW_PAUSED',
                    message: 'Questa intervista è temporaneamente non disponibile. Riprova più tardi.'
                }
            };
        }

        // Check response limit before starting
        const orgId = bot.project?.organization?.id;
        if (orgId) {
            const limitCheck = await planService.checkResponseLimit(orgId);

            if (!limitCheck.allowed) {
                // Pause this interview
                await db.bot.update({
                    where: { id: botId },
                    data: { status: 'PAUSED' }
                });

                return {
                    error: {
                        code: 'LIMIT_REACHED',
                        message: 'Questa intervista è temporaneamente non disponibile. Riprova più tardi.'
                    }
                };
            }
        }

        return { bot };
    }

    /**
     * Resume paused interviews when limit is lifted
     */
    async resumePausedInterviews(orgId: string): Promise<void> {
        const limitCheck = await planService.checkResponseLimit(orgId);

        if (limitCheck.allowed && limitCheck.remaining > 0) {
            const resumed = await db.bot.updateMany({
                where: {
                    project: {
                        organizationId: orgId
                    },
                    status: 'PAUSED'
                },
                data: {
                    status: 'PUBLISHED'
                }
            });

            console.log(`▶️  Resumed ${resumed.count} interviews for org ${orgId}`);
        }
    }
}

export const interviewService = new InterviewService();
