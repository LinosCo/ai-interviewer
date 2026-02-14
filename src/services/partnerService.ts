/**
 * Partner Service
 *
 * Gestisce la logica del programma Partner:
 * - Registrazione come partner
 * - Gestione trial 60 giorni
 * - Tracking organizzazioni clienti attive
 * - Calcolo fee (€0 con 3+ clienti, €29 altrimenti)
 * - White label con 10+ clienti
 * - Trasferimento progetti verso organizzazioni
 */

import { prisma } from '@/lib/prisma';
import { PARTNER_THRESHOLDS } from '@/config/plans';
import crypto from 'crypto';
import { assertProjectAccess, moveProjectToOrganization } from '@/lib/domain/workspace';

// ============================================
// TYPES
// ============================================

export interface PartnerStatus {
    isPartner: boolean;
    status: 'trial' | 'active' | 'suspended' | 'grace_period' | null;
    trialEndDate: Date | null;
    trialDaysRemaining: number | null;
    activeClients: number; // Organizzazioni con piano pagante
    monthlyFee: number;
    hasWhiteLabel: boolean;
    gracePeriodEndDate: Date | null;
    customLogo: string | null;
}

export interface PartnerClient {
    id: string; // Organization ID
    name: string;
    email: string; // Billing email o owner email
    projectsCount: number;
    totalCreditsUsed: number;
    createdAt: Date;
    status: 'active' | 'inactive';
}

export interface PartnerClientDetailed {
    attributionId: string;
    organizationId: string;
    organizationName: string | null;
    ownerEmail: string;
    plan: string;
    subscriptionStatus: string | null;
    isActive: boolean; // Conta per soglie?
    attributedAt: Date;
    firstProjectName: string | null;
    projectsCount: number;
}

export interface PartnerClientsSummary {
    clients: PartnerClientDetailed[];
    summary: {
        totalAttributed: number;
        activeClients: number;
        pendingInvites: number;
    };
    thresholds: {
        freeAccess: { required: number; current: number; met: boolean };
        whiteLabel: { required: number; current: number; met: boolean };
    };
}

export interface TransferResult {
    success: boolean;
    error?: string;
    inviteId?: string;
    inviteUrl?: string;
}

// ============================================
// PARTNER SERVICE
// ============================================

export const PartnerService = {
    /**
     * Registra un utente come partner (avvia trial 60 giorni)
     */
    async registerAsPartner(userId: string): Promise<{ success: boolean; error?: string }> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isPartner: true }
        });

        if (!user) {
            return { success: false, error: 'Utente non trovato' };
        }

        if (user.isPartner) {
            return { success: false, error: 'Sei già registrato come partner' };
        }

        // Calcola data fine trial
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + PARTNER_THRESHOLDS.trialDays);

        await prisma.user.update({
            where: { id: userId },
            data: {
                isPartner: true,
                partnerStatus: 'trial',
                partnerTrialEndDate: trialEndDate,
                partnerFee: 0, // Trial gratuito
                partnerActiveClients: 0,
                partnerWhiteLabel: false
            }
        });

        return { success: true };
    },

    /**
     * Ottiene lo status completo del partner
     */
    async getPartnerStatus(userId: string): Promise<PartnerStatus | null> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                isPartner: true,
                partnerStatus: true,
                partnerTrialEndDate: true,
                partnerActiveClients: true,
                partnerFee: true,
                partnerWhiteLabel: true,
                partnerGracePeriodStart: true,
                partnerCustomLogo: true
            }
        });

        if (!user || !user.isPartner) {
            return null;
        }

        const now = new Date();
        let trialDaysRemaining: number | null = null;
        let gracePeriodEndDate: Date | null = null;

        // Calcola giorni trial rimanenti
        if (user.partnerStatus === 'trial' && user.partnerTrialEndDate) {
            const diffTime = user.partnerTrialEndDate.getTime() - now.getTime();
            trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        // Calcola fine grace period
        if (user.partnerGracePeriodStart) {
            gracePeriodEndDate = new Date(user.partnerGracePeriodStart);
            gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + PARTNER_THRESHOLDS.gracePeriodDays);
        }

        // Calcola fee mensile
        const activeClients = user.partnerActiveClients || 0;
        const monthlyFee = activeClients >= PARTNER_THRESHOLDS.freeThreshold ? 0 : PARTNER_THRESHOLDS.baseMonthlyFee;

        // White label con 10+ clienti
        const hasWhiteLabel = activeClients >= PARTNER_THRESHOLDS.whiteLabelThreshold;

        return {
            isPartner: true,
            status: user.partnerStatus as PartnerStatus['status'],
            trialEndDate: user.partnerTrialEndDate,
            trialDaysRemaining,
            activeClients,
            monthlyFee,
            hasWhiteLabel,
            gracePeriodEndDate,
            customLogo: user.partnerCustomLogo
        };
    },

    /**
     * Aggiorna il logo personalizzato del partner
     */
    async updateCustomLogo(userId: string, logoUrl: string | null): Promise<{ success: boolean; error?: string }> {
        const status = await this.getPartnerStatus(userId);

        if (!status) {
            return { success: false, error: 'Partner non trovato' };
        }

        if (!status.hasWhiteLabel) {
            return { success: false, error: 'Funzionalità White Label non attiva' };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { partnerCustomLogo: logoUrl }
        });

        return { success: true };
    },

    /**
     * Ottiene la lista dei clienti del partner (Organizzazioni)
     */
    async getPartnerClients(userId: string): Promise<PartnerClient[]> {
        // Trova attribuzioni
        const attributions = await prisma.partnerClientAttribution.findMany({
            where: { partnerId: userId },
            include: {
                clientUser: {
                    include: {
                        memberships: {
                            where: { role: 'OWNER' },
                            include: {
                                organization: {
                                    include: {
                                        _count: { select: { projects: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        return attributions.map(attr => {
            const clientUser = attr.clientUser;
            const org = clientUser?.memberships[0]?.organization;

            return {
                id: org?.id || '',
                name: org?.name || 'Sconosciuto',
                email: clientUser?.email || '',
                projectsCount: org?._count.projects || 0,
                totalCreditsUsed: Number(org?.monthlyCreditsUsed || 0),
                createdAt: org?.createdAt || attr.attributedAt,
                status: 'active'
            };
        });
    },

    /**
     * Crea un invito per trasferire un progetto verso un'organizzazione
     */
    async createProjectTransferInvite(params: {
        partnerId: string;
        projectId: string;
        toEmail: string; // Email della persona che riceverà il progetto (nella sua org)
    }): Promise<TransferResult> {
        const { partnerId, projectId, toEmail } = params;
        const normalizedRecipientEmail = toEmail.trim().toLowerCase();

        // Verifica che l'utente sia partner
        const user = await prisma.user.findUnique({
            where: { id: partnerId },
            select: { isPartner: true, partnerStatus: true }
        });

        if (!user?.isPartner) {
            return { success: false, error: 'Devi essere un partner per trasferire progetti' };
        }

        if (user.partnerStatus === 'suspended') {
            return { success: false, error: 'Il tuo account partner è sospeso' };
        }

        // Verifica accesso admin al progetto con il nuovo modello org-first
        try {
            await assertProjectAccess(partnerId, projectId, 'ADMIN');
        } catch {
            return { success: false, error: 'Progetto non trovato o non hai i permessi per trasferirlo' };
        }

        // Verifica se esiste già un invito pendente
        const existingInvite = await prisma.projectTransferInvite.findFirst({
            where: {
                projectId,
                status: 'pending'
            }
        });

        if (existingInvite) {
            return { success: false, error: 'Esiste già un invito pendente per questo progetto' };
        }

        // Genera token univoco
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Scade in 7 giorni

        // Crea invito
        const invite = await prisma.projectTransferInvite.create({
            data: {
                projectId,
                partnerId: partnerId,
                clientEmail: normalizedRecipientEmail,
                token,
                expiresAt,
                status: 'pending'
            }
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteUrl = `${baseUrl}/transfer/accept?token=${token}`;

        return {
            success: true,
            inviteId: invite.id,
            inviteUrl
        };
    },

    /**
     * Accetta un invito di trasferimento (da parte del cliente)
     * Sposta il progetto nell'organizzazione target dell'utente
     */
    async acceptProjectTransfer(params: {
        token: string;
        acceptingUserId: string;
        targetOrganizationId: string;
    }): Promise<TransferResult> {
        const { token, acceptingUserId, targetOrganizationId } = params;

        // Trova l'invito
        const invite = await prisma.projectTransferInvite.findUnique({
            where: { token }
        });

        if (!invite) {
            return { success: false, error: 'Invito non trovato' };
        }

        if (invite.status !== 'pending') {
            return { success: false, error: 'Invito già utilizzato o scaduto' };
        }

        if (new Date() > invite.expiresAt) {
            await prisma.projectTransferInvite.update({
                where: { id: invite.id },
                data: { status: 'expired' }
            });
            return { success: false, error: 'Invito scaduto' };
        }

        // Verifica email (opzionale se l'utente è già loggato e vogliamo essere flessibili, ma meglio per sicurezza)
        const acceptingUser = await prisma.user.findUnique({
            where: { id: acceptingUserId },
            select: { email: true }
        });

        if (acceptingUser?.email?.toLowerCase() !== invite.clientEmail.toLowerCase()) {
            return { success: false, error: 'Questo invito è per un altro indirizzo email' };
        }

        // Move project to target organization (no duplication).
        await moveProjectToOrganization({
            projectId: invite.projectId,
            targetOrganizationId,
            actorUserId: acceptingUserId
        });

        await prisma.$transaction(async (tx) => {
            await tx.projectTransferInvite.update({
                where: { id: invite.id },
                data: {
                    status: 'accepted',
                    acceptedAt: new Date()
                }
            });

            const existingAttribution = await tx.partnerClientAttribution.findUnique({
                where: { clientUserId: acceptingUserId }
            });

            if (!existingAttribution) {
                await tx.partnerClientAttribution.create({
                    data: {
                        partnerId: invite.partnerId,
                        clientUserId: acceptingUserId,
                        firstProjectId: invite.projectId,
                        status: 'active'
                    }
                });
            }

            await this.refreshPartnerActiveClientsCount(invite.partnerId, tx);
        });

        // Aggiorna status partner globale (white label, fee, etc.)
        await this.updatePartnerStatus(invite.partnerId);

        return { success: true };
    },

    /**
     * Ricalcola il conteggio dei clienti attivi (organizzazioni con piano pagante)
     */
    async refreshPartnerActiveClientsCount(partnerId: string, tx?: any): Promise<number> {
        const db = tx || prisma;

        const attributions = await db.partnerClientAttribution.findMany({
            where: {
                partnerId: partnerId,
                status: 'active'
            },
            include: {
                clientUser: {
                    include: {
                        memberships: {
                            where: { role: 'OWNER' },
                            include: {
                                organization: {
                                    select: { plan: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        const activeCount = attributions.filter((attr: any) => {
            const memberships = attr.clientUser?.memberships || [];
            return memberships.some((m: any) => ['STARTER', 'PRO', 'BUSINESS'].includes(m.organization.plan));
        }).length;

        await db.user.update({
            where: { id: partnerId },
            data: { partnerActiveClients: activeCount }
        });

        return activeCount;
    },

    /**
     * Conta i clienti attivi del partner
     */
    async getActiveClientsCount(partnerId: string): Promise<number> {
        const attributions = await prisma.partnerClientAttribution.findMany({
            where: {
                partnerId: partnerId,
                status: 'active'
            },
            include: {
                clientUser: {
                    include: {
                        memberships: {
                            where: { role: 'OWNER' },
                            include: {
                                organization: {
                                    select: { plan: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        return attributions.filter((attr: any) => {
            const memberships = attr.clientUser?.memberships || [];
            return memberships.some((m: any) => ['STARTER', 'PRO', 'BUSINESS'].includes(m.organization.plan));
        }).length;
    },

    /**
     * Aggiorna lo status del partner basato sui clienti attivi
     */
    async updatePartnerStatus(userId: string): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                isPartner: true,
                partnerStatus: true,
                partnerActiveClients: true,
                partnerTrialEndDate: true
            }
        });

        if (!user?.isPartner) return;

        const now = new Date();
        const activeClients = user.partnerActiveClients || 0;

        // Calcola nuovo status
        let newStatus = user.partnerStatus;
        let newFee: number = PARTNER_THRESHOLDS.baseMonthlyFee;
        let whiteLabel = false;
        let gracePeriodStart: Date | null = null;

        // Controlla se trial è scaduto
        if (user.partnerStatus === 'trial' && user.partnerTrialEndDate && now > user.partnerTrialEndDate) {
            if (activeClients >= PARTNER_THRESHOLDS.freeThreshold) {
                newStatus = 'active';
                newFee = 0;
            } else {
                // Avvia grace period
                newStatus = 'grace_period';
                gracePeriodStart = now;
            }
        }

        // Se già attivo o in grace period, controlla se ha raggiunto i 3 clienti
        if (activeClients >= PARTNER_THRESHOLDS.freeThreshold) {
            newStatus = 'active';
            newFee = 0;
        }

        // White label con 10+ clienti
        if (activeClients >= PARTNER_THRESHOLDS.whiteLabelThreshold) {
            whiteLabel = true;
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                partnerStatus: newStatus,
                partnerFee: newFee,
                partnerWhiteLabel: whiteLabel,
                ...(gracePeriodStart && { partnerGracePeriodStart: gracePeriodStart })
            }
        });
    },

    /**
     * Ottiene lista clienti dettagliata per dashboard partner (Organizzazioni)
     */
    async getPartnerClientsDetailed(partnerId: string): Promise<PartnerClientsSummary> {
        const [attributions, pendingInvites] = await Promise.all([
            prisma.partnerClientAttribution.findMany({
                where: { partnerId, status: 'active' },
                include: {
                    clientUser: {
                        include: {
                            memberships: {
                                where: { role: 'OWNER' },
                                include: {
                                    organization: {
                                        include: {
                                            _count: { select: { projects: true } }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    firstProject: { select: { name: true } }
                }
            }),
            prisma.projectTransferInvite.count({
                where: {
                    partnerId,
                    status: 'pending',
                    expiresAt: { gt: new Date() }
                }
            })
        ]);

        const clients: PartnerClientDetailed[] = attributions.map(attr => {
            const clientUser = attr.clientUser;
            const org = clientUser?.memberships[0]?.organization;
            const plan = org?.plan || 'FREE';
            const isActive = ['STARTER', 'PRO', 'BUSINESS'].includes(plan);

            return {
                attributionId: attr.id,
                organizationId: org?.id || '',
                organizationName: org?.name || 'Sconosciuto',
                ownerEmail: clientUser?.email || '',
                plan,
                subscriptionStatus: org?.subscriptionStatus || null,
                isActive,
                attributedAt: attr.attributedAt,
                firstProjectName: attr.firstProject?.name || null,
                projectsCount: org?._count.projects || 0
            };
        });

        const activeClients = clients.filter(c => c.isActive).length;

        return {
            clients,
            summary: {
                totalAttributed: clients.length,
                activeClients,
                pendingInvites
            },
            thresholds: {
                freeAccess: {
                    required: PARTNER_THRESHOLDS.freeThreshold,
                    current: activeClients,
                    met: activeClients >= PARTNER_THRESHOLDS.freeThreshold
                },
                whiteLabel: {
                    required: PARTNER_THRESHOLDS.whiteLabelThreshold,
                    current: activeClients,
                    met: activeClients >= PARTNER_THRESHOLDS.whiteLabelThreshold
                }
            }
        };
    }
};

export default PartnerService;
