/**
 * Partner Service
 *
 * Gestisce la logica del programma Partner:
 * - Registrazione come partner
 * - Gestione trial 60 giorni
 * - Tracking clienti attivi
 * - Calcolo fee (€0 con 3+ clienti, €29 altrimenti)
 * - White label con 10+ clienti
 * - Trasferimento progetti
 */

import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, PARTNER_THRESHOLDS } from '@/config/plans';

// ============================================
// TYPES
// ============================================

export interface PartnerStatus {
    isPartner: boolean;
    status: 'trial' | 'active' | 'suspended' | 'grace_period' | null;
    trialEndDate: Date | null;
    trialDaysRemaining: number | null;
    activeClients: number;
    monthlyFee: number;
    hasWhiteLabel: boolean;
    gracePeriodEndDate: Date | null;
    customLogo: string | null;
}

export interface PartnerClient {
    id: string;
    name: string;
    email: string;
    projectsCount: number;
    totalCreditsUsed: number;
    createdAt: Date;
    status: 'active' | 'inactive';
}

export interface PartnerClientDetailed {
    attributionId: string;
    clientId: string;
    clientName: string | null;
    clientEmail: string;
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
            select: { isPartner: true, plan: true }
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
                partnerWhiteLabel: false,
                plan: PlanType.PARTNER,
                monthlyCreditsLimit: BigInt(PLANS[PlanType.PARTNER].monthlyCredits)
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
     * Ottiene la lista dei clienti del partner
     */
    async getPartnerClients(userId: string): Promise<PartnerClient[]> {
        // Trova progetti trasferiti dal partner
        const transfers = await prisma.projectTransfer.findMany({
            where: {
                partnerId: userId
            },
            include: {
                duplicatedProject: {
                    include: {
                        owner: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                monthlyCreditsUsed: true,
                                createdAt: true
                            }
                        }
                    }
                }
            }
        });

        // Raggruppa per utente destinatario (clientId)
        const clientsMap = new Map<string, PartnerClient>();

        for (const transfer of transfers) {
            const client = transfer.duplicatedProject?.owner;
            if (!client) continue;

            const existing = clientsMap.get(client.id);
            if (existing) {
                existing.projectsCount++;
            } else {
                clientsMap.set(client.id, {
                    id: client.id,
                    name: client.name || 'Sconosciuto',
                    email: client.email || '',
                    projectsCount: 1,
                    totalCreditsUsed: Number(client.monthlyCreditsUsed || 0),
                    createdAt: client.createdAt,
                    status: 'active'
                });
            }
        }

        return Array.from(clientsMap.values());
    },

    /**
     * Crea un invito per trasferire un progetto
     */
    async createProjectTransferInvite(params: {
        fromUserId: string;
        projectId: string;
        toEmail: string;
    }): Promise<TransferResult> {
        const { fromUserId, projectId, toEmail } = params;

        // Verifica che l'utente sia partner
        const user = await prisma.user.findUnique({
            where: { id: fromUserId },
            select: { isPartner: true, partnerStatus: true }
        });

        if (!user?.isPartner) {
            return { success: false, error: 'Devi essere un partner per trasferire progetti' };
        }

        if (user.partnerStatus === 'suspended') {
            return { success: false, error: 'Il tuo account partner è sospeso' };
        }

        // Verifica che il progetto esista e appartenga al partner
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                ownerId: fromUserId
            }
        });

        if (!project) {
            return { success: false, error: 'Progetto non trovato o non sei il proprietario' };
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
                partnerId: fromUserId,
                clientEmail: toEmail,
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
     * Accetta un invito di trasferimento
     */
    async acceptProjectTransfer(params: {
        token: string;
        acceptingUserId: string;
    }): Promise<TransferResult> {
        const { token, acceptingUserId } = params;

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

        // Verifica email
        const acceptingUser = await prisma.user.findUnique({
            where: { id: acceptingUserId },
            select: { email: true }
        });

        if (acceptingUser?.email?.toLowerCase() !== invite.clientEmail.toLowerCase()) {
            return { success: false, error: 'Questo invito è per un altro indirizzo email' };
        }

        // Get the project to duplicate
        const originalProject = await prisma.project.findUnique({
            where: { id: invite.projectId }
        });

        if (!originalProject) {
            return { success: false, error: 'Progetto non trovato' };
        }

        // Esegui trasferimento (duplica progetto invece di trasferirlo)
        await prisma.$transaction(async (tx) => {
            // Aggiorna invito
            await tx.projectTransferInvite.update({
                where: { id: invite.id },
                data: { status: 'accepted' }
            });

            // Crea copia del progetto per il cliente
            const duplicatedProject = await tx.project.create({
                data: {
                    name: originalProject.name,
                    ownerId: acceptingUserId,
                    organizationId: originalProject.organizationId,
                    originPartnerId: invite.partnerId // Traccia origine
                }
            });

            // Crea record trasferimento
            await tx.projectTransfer.create({
                data: {
                    originalProjectId: invite.projectId,
                    duplicatedProjectId: duplicatedProject.id,
                    partnerId: invite.partnerId,
                    clientId: acceptingUserId
                }
            });

            // Crea attribuzione SE non esiste già
            const existingAttribution = await tx.partnerClientAttribution.findUnique({
                where: { clientUserId: acceptingUserId }
            });

            if (!existingAttribution) {
                await tx.partnerClientAttribution.create({
                    data: {
                        partnerId: invite.partnerId,
                        clientUserId: acceptingUserId,
                        firstProjectId: duplicatedProject.id,
                        status: 'active'
                    }
                });
            }

            // Ricalcola clienti attivi
            const activeCount = await tx.partnerClientAttribution.count({
                where: {
                    partnerId: invite.partnerId,
                    status: 'active',
                    clientUser: {
                        plan: { in: ['STARTER', 'PRO', 'BUSINESS'] }
                    }
                }
            });

            await tx.user.update({
                where: { id: invite.partnerId },
                data: { partnerActiveClients: activeCount }
            });
        });

        // Aggiorna status partner (white label, fee, etc.)
        await this.updatePartnerStatus(invite.partnerId);

        return { success: true };
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

        // Se già attivo, controlla soglie
        if (user.partnerStatus === 'active' || user.partnerStatus === 'grace_period') {
            if (activeClients >= PARTNER_THRESHOLDS.freeThreshold) {
                newStatus = 'active';
                newFee = 0;
            }
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
     * Aggiorna logo personalizzato del partner (solo con white label)
     */
    async updateCustomLogo(userId: string, logoUrl: string | null): Promise<{ success: boolean; error?: string }> {
        const status = await this.getPartnerStatus(userId);

        if (!status?.hasWhiteLabel) {
            return { success: false, error: 'White label non disponibile. Raggiungi 10+ clienti.' };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { partnerCustomLogo: logoUrl }
        });

        return { success: true };
    },

    /**
     * Verifica e aggiorna tutti i partner (per cron)
     */
    async checkAllPartnersStatus(): Promise<{ updated: number }> {
        const partners = await prisma.user.findMany({
            where: { isPartner: true },
            select: { id: true }
        });

        let updated = 0;
        for (const partner of partners) {
            await this.updatePartnerStatus(partner.id);
            updated++;
        }

        return { updated };
    },

    // ============================================
    // FUNZIONI ATTRIBUZIONE PARTNER-CLIENTE
    // ============================================

    /**
     * Verifica se un cliente è già attribuito a qualche partner
     */
    async getExistingAttribution(clientUserId: string): Promise<{
        exists: boolean;
        partnerId?: string;
        attributedAt?: Date;
    }> {
        const attribution = await prisma.partnerClientAttribution.findUnique({
            where: { clientUserId },
            select: {
                partnerId: true,
                attributedAt: true
            }
        });

        if (!attribution) {
            return { exists: false };
        }

        return {
            exists: true,
            partnerId: attribution.partnerId,
            attributedAt: attribution.attributedAt
        };
    },

    /**
     * Crea attribuzione partner → cliente (se non esiste già)
     */
    async createAttribution(params: {
        partnerId: string;
        clientUserId: string;
        firstProjectId?: string;
    }): Promise<{ success: boolean; created: boolean; error?: string }> {
        const { partnerId, clientUserId, firstProjectId } = params;

        // Verifica se già attribuito
        const existing = await this.getExistingAttribution(clientUserId);

        if (existing.exists) {
            return {
                success: true,
                created: false,
                error: existing.partnerId === partnerId
                    ? 'Cliente già attribuito a te'
                    : 'Cliente già attribuito ad altro partner'
            };
        }

        // Crea attribuzione
        await prisma.partnerClientAttribution.create({
            data: {
                partnerId,
                clientUserId,
                firstProjectId,
                status: 'active'
            }
        });

        return { success: true, created: true };
    },

    /**
     * Conta clienti attivi (con abbonamento pagante) per un partner
     */
    async getActiveClientsCount(partnerId: string): Promise<number> {
        const count = await prisma.partnerClientAttribution.count({
            where: {
                partnerId,
                status: 'active',
                clientUser: {
                    plan: { in: ['STARTER', 'PRO', 'BUSINESS'] }
                }
            }
        });

        return count;
    },

    /**
     * Ottiene lista clienti dettagliata per dashboard partner
     */
    async getPartnerClientsDetailed(partnerId: string): Promise<PartnerClientsSummary> {
        // 1. Ottieni attribuzioni con dati cliente
        const attributions = await prisma.partnerClientAttribution.findMany({
            where: {
                partnerId,
                status: 'active'
            },
            include: {
                clientUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        plan: true,
                        memberships: {
                            take: 1,
                            include: {
                                organization: {
                                    include: {
                                        subscription: {
                                            select: { status: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                firstProject: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        // 2. Conta progetti per cliente
        const projectCounts = await prisma.projectTransfer.groupBy({
            by: ['clientId'],
            where: {
                partnerId,
                clientId: { in: attributions.map(a => a.clientUserId) }
            },
            _count: { id: true }
        });

        const projectCountMap = new Map(
            projectCounts.map(p => [p.clientId, p._count.id])
        );

        // 3. Conta inviti pendenti
        const pendingInvites = await prisma.projectTransferInvite.count({
            where: {
                partnerId,
                status: 'pending',
                expiresAt: { gt: new Date() }
            }
        });

        // 4. Mappa a formato dettagliato
        const clients: PartnerClientDetailed[] = attributions.map(attr => {
            const subscriptionStatus = attr.clientUser.memberships[0]?.organization?.subscription?.status || null;
            const plan = attr.clientUser.plan;
            const isActive = ['STARTER', 'PRO', 'BUSINESS'].includes(plan) && subscriptionStatus === 'ACTIVE';

            return {
                attributionId: attr.id,
                clientId: attr.clientUserId,
                clientName: attr.clientUser.name,
                clientEmail: attr.clientUser.email,
                plan,
                subscriptionStatus,
                isActive,
                attributedAt: attr.attributedAt,
                firstProjectName: attr.firstProject?.name || null,
                projectsCount: projectCountMap.get(attr.clientUserId) || 1
            };
        });

        // 5. Calcola summary
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
