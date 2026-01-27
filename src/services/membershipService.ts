/**
 * Membership Service
 *
 * Gestisce le appartenenze degli utenti alle organizzazioni e i ruoli (RBAC).
 */

import { prisma } from '@/lib/prisma';
import { Role, MemberStatus } from '@prisma/client';

export const MembershipService = {
    /**
     * Ottiene tutte le organizzazioni di un utente
     */
    async getUserOrganizations(userId: string) {
        return prisma.organization.findMany({
            where: {
                members: {
                    some: { userId }
                }
            },
            include: {
                _count: {
                    select: { members: true, projects: true }
                }
            }
        });
    },

    /**
     * Verifica se un utente è membro di un'organizzazione e con quale ruolo
     */
    async getMembership(userId: string, organizationId: string) {
        return prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            }
        });
    },

    /**
     * Cambia il ruolo di un membro
     */
    async updateMemberRole(organizationId: string, userId: string, newRole: Role) {
        return prisma.membership.update({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            },
            data: { role: newRole }
        });
    },

    /**
     * Rimuove un membro da un'organizzazione
     */
    async removeMember(organizationId: string, userId: string) {
        return prisma.membership.delete({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            }
        });
    },

    /**
     * Verifica i permessi per un'azione specifica
     */
    async hasPermission(userId: string, organizationId: string, requiredRole: Role): Promise<boolean> {
        const membership = await this.getMembership(userId, organizationId);
        if (!membership || membership.status !== MemberStatus.ACTIVE) return false;

        // Gerarchia ruoli: OWNER > ADMIN > MEMBER
        const roles: Role[] = [Role.MEMBER, Role.ADMIN, Role.OWNER];
        const userRoleIndex = roles.indexOf(membership.role);
        const requiredRoleIndex = roles.indexOf(requiredRole);

        return userRoleIndex >= requiredRoleIndex;
    }
};

export default MembershipService;
