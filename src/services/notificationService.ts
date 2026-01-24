import { prisma as db } from '@/lib/prisma';
import { planService } from './planService';

export interface NotificationPayload {
    type: 'RESPONSE_LIMIT_REACHED' | 'INTERVIEW_PAUSED' | 'FEATURE_LOCKED' | 'UPGRADE_AVAILABLE';
    title: string;
    message: string;
    actions?: Array<{
        label: string;
        url: string;
        primary?: boolean;
    }>;
    metadata?: any;
}

export class NotificationService {

    async send(orgId: string, payload: NotificationPayload): Promise<void> {
        try {
            // Get organization admin users
            const org = await db.organization.findUnique({
                where: { id: orgId },
                include: {
                    members: {
                        where: {
                            role: 'ADMIN'
                        },
                        include: {
                            user: true
                        }
                    }
                }
            });

            if (!org) {
                console.error('Organization not found:', orgId);
                return;
            }

            // Log notification (could be extended to send emails, push notifications, etc.)
            console.log(`📧 Notification for ${org.name}:`, payload);

            // Store notification in database for in-app display
            // TODO: Create Notification model in schema if needed

            // For now, we'll just log it
            // In production, you'd want to:
            // 1. Create a Notification record
            // 2. Send email to admin users
            // 3. Send push notification if enabled
            // 4. Create in-app notification badge

            for (const member of org.members) {
                console.log(`  → ${member.user.email}: ${payload.title}`);
            }

        } catch (error) {
            console.error('Failed to send notification:', error);
        }
    }

    async notifyResponseLimitReached(orgId: string): Promise<void> {
        const limitCheck = await planService.checkResponseLimit(orgId);

        await this.send(orgId, {
            type: 'RESPONSE_LIMIT_REACHED',
            title: 'Limite risposte mensili raggiunto',
            message: `Hai utilizzato tutte le ${limitCheck.limit} risposte incluse nel tuo piano. Le interviste sono in pausa.`,
            actions: [
                {
                    label: 'Acquista risposte extra',
                    url: '/billing/add-responses',
                    primary: false
                },
                {
                    label: 'Fai upgrade',
                    url: '/dashboard/billing/plans',
                    primary: true
                }
            ],
            metadata: {
                used: limitCheck.used,
                limit: limitCheck.limit
            }
        });
    }

    async notifyInterviewPaused(orgId: string, interviewId: string, reason: string): Promise<void> {
        await this.send(orgId, {
            type: 'INTERVIEW_PAUSED',
            title: 'Intervista messa in pausa',
            message: `L'intervista è stata automaticamente messa in pausa: ${reason}`,
            actions: [
                {
                    label: 'Visualizza intervista',
                    url: `/dashboard/bots/${interviewId}`,
                    primary: true
                }
            ]
        });
    }

    async notifyFeatureLocked(orgId: string, feature: string): Promise<void> {
        await this.send(orgId, {
            type: 'FEATURE_LOCKED',
            title: 'Feature non disponibile',
            message: `La feature "${feature}" non è disponibile nel tuo piano attuale.`,
            actions: [
                {
                    label: 'Scopri i piani',
                    url: '/dashboard/billing/plans',
                    primary: true
                }
            ]
        });
    }
}

export const notificationService = new NotificationService();
