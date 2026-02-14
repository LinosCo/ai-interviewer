/**
 * MCP Connection Management Service
 * Handles multi-project sharing and cross-organization transfers for MCP connections
 */

import { prisma } from '@/lib/prisma';
import { MCPConnectionType } from '@prisma/client';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';

export interface CreateMCPConnectionInput {
    projectId: string;
    organizationId: string;
    type: MCPConnectionType;
    name: string;
    endpoint: string;
    credentials: any;
    createdBy: string;
}

export class MCPConnectionService {
    /**
     * Associate an MCP connection with a project.
     * Allows sharing connections across multiple projects.
     */
    static async associateProject(
        connectionId: string,
        projectId: string,
        userId: string,
        role: 'OWNER' | 'EDITOR' | 'VIEWER' = 'VIEWER'
    ): Promise<{ success: boolean; error?: string }> {
        // Get connection and verify it exists
        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            include: { organization: true }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Get project and verify it exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { organization: true }
        });

        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        if (project.organizationId) {
            const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
            if (!integrationCheck.allowed) {
                return { success: false, error: integrationCheck.reason || 'Integration creation unavailable on trial' };
            }
        }

        // Verify user has permission in the connection's organization
        if (connection.organizationId) {
            const orgMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: connection.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            if (!orgMembership) {
                return { success: false, error: 'Insufficient permissions in the connection organization' };
            }
        }

        // Check if already associated
        const existing = await prisma.projectMCPConnection.findUnique({
            where: {
                projectId_connectionId: {
                    projectId,
                    connectionId
                }
            }
        });

        if (existing) {
            return { success: false, error: 'Connection already associated with this project' };
        }

        // Create association
        await prisma.projectMCPConnection.create({
            data: {
                projectId,
                connectionId,
                role,
                createdBy: userId
            }
        });

        // Log the action
        await prisma.integrationLog.create({
            data: {
                mcpConnectionId: connectionId,
                action: 'mcp.project_associated',
                success: true,
                durationMs: 0,
                result: {
                    projectId,
                    role,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }

    /**
     * Dissociate an MCP connection from a project.
     */
    static async dissociateProject(
        connectionId: string,
        projectId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Verify connection exists
        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            select: { organizationId: true }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission
        if (connection.organizationId) {
            const orgMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: connection.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            if (!orgMembership) {
                return { success: false, error: 'Insufficient permissions' };
            }
        }

        // Delete association
        const deleted = await prisma.projectMCPConnection.deleteMany({
            where: {
                projectId,
                connectionId
            }
        });

        if (deleted.count === 0) {
            return { success: false, error: 'Association not found' };
        }

        // Log the action
        await prisma.integrationLog.create({
            data: {
                mcpConnectionId: connectionId,
                action: 'mcp.project_dissociated',
                success: true,
                durationMs: 0,
                result: {
                    projectId,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }

    /**
     * Get all projects associated with an MCP connection.
     */
    static async getAssociatedProjects(connectionId: string) {
        const associations = await prisma.projectMCPConnection.findMany({
            where: { connectionId },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return associations.map(assoc => ({
            projectId: assoc.project.id,
            projectName: assoc.project.name,
            organization: assoc.project.organization,
            role: assoc.role,
            associatedAt: assoc.createdAt,
            associatedBy: assoc.createdBy
        }));
    }

    /**
     * Get all MCP connections available to a project.
     * Includes both direct connections and shared connections.
     */
    static async getProjectConnections(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });

        if (!project || !project.organizationId) {
            return [];
        }

        // Get direct connection
        const direct = await prisma.mCPConnection.findMany({
            where: { projectId },
            select: {
                id: true,
                type: true,
                name: true,
                endpoint: true,
                status: true,
                lastPingAt: true,
                lastSyncAt: true,
                lastError: true,
                availableTools: true,
                serverVersion: true,
                serverName: true,
                createdAt: true
            }
        });

        // Get shared connections
        const shared = await prisma.projectMCPConnection.findMany({
            where: { projectId },
            include: {
                connection: {
                    select: {
                        id: true,
                        type: true,
                        name: true,
                        endpoint: true,
                        status: true,
                        lastPingAt: true,
                        lastSyncAt: true,
                        lastError: true,
                        availableTools: true,
                        serverVersion: true,
                        serverName: true,
                        createdAt: true
                    }
                }
            }
        });

        return [
            ...direct.map(d => ({
                ...d,
                associationType: 'DIRECT' as const,
                role: 'OWNER',
                associatedAt: d.createdAt
            })),
            ...shared.map(s => ({
                ...s.connection,
                associationType: 'SHARED' as const,
                role: s.role,
                associatedAt: s.createdAt
            }))
        ];
    }

    /**
     * Get all MCP connections for an organization.
     */
    static async getOrganizationConnections(organizationId: string) {
        return prisma.mCPConnection.findMany({
            where: { organizationId },
            select: {
                id: true,
                type: true,
                name: true,
                endpoint: true,
                status: true,
                lastPingAt: true,
                lastSyncAt: true,
                lastError: true,
                availableTools: true,
                serverVersion: true,
                serverName: true,
                createdAt: true,
                projectShares: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Transfer MCP connection to another organization.
     */
    static async transferToOrganization(
        connectionId: string,
        targetOrganizationId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Get source connection
        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            include: {
                organization: true,
                projectShares: {
                    include: {
                        project: true
                    }
                }
            }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission in source organization
        if (connection.organizationId) {
            const sourceMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: connection.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            if (!sourceMembership) {
                return { success: false, error: 'Insufficient permissions in source organization' };
            }
        }

        // Verify user has permission in target organization
        const targetMembership = await prisma.membership.findFirst({
            where: {
                userId,
                organizationId: targetOrganizationId,
                role: { in: ['OWNER', 'ADMIN'] }
            }
        });

        if (!targetMembership) {
            return { success: false, error: 'Insufficient permissions in target organization' };
        }

        // Verify target organization exists
        const targetOrg = await prisma.organization.findUnique({
            where: { id: targetOrganizationId }
        });

        if (!targetOrg) {
            return { success: false, error: 'Target organization not found' };
        }

        // Remove all project associations (they belong to the old org)
        await prisma.projectMCPConnection.deleteMany({
            where: { connectionId }
        });

        // Get first project in target org to maintain backward compat with projectId
        const targetProject = await prisma.project.findFirst({
            where: { organizationId: targetOrganizationId },
            orderBy: { createdAt: 'asc' }
        });

        // Transfer the connection
        await prisma.mCPConnection.update({
            where: { id: connectionId },
            data: {
                organizationId: targetOrganizationId,
                projectId: targetProject?.id || connection.projectId // Keep old if no projects in target
            }
        });

        // Log the action
        await prisma.integrationLog.create({
            data: {
                mcpConnectionId: connectionId,
                action: 'mcp.organization_transferred',
                success: true,
                durationMs: 0,
                result: {
                    fromOrganizationId: connection.organizationId,
                    toOrganizationId: targetOrganizationId,
                    performedBy: userId
                }
            }
        });

        return { success: true };
    }

    /**
     * Delete an MCP connection and all its associations.
     */
    static async deleteConnection(
        connectionId: string,
        userId: string
    ): Promise<{ success: boolean; error?: string }> {
        // Verify connection exists
        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            select: { organizationId: true }
        });

        if (!connection) {
            return { success: false, error: 'Connection not found' };
        }

        // Verify user has permission
        if (connection.organizationId) {
            const orgMembership = await prisma.membership.findFirst({
                where: {
                    userId,
                    organizationId: connection.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            if (!orgMembership) {
                return { success: false, error: 'Insufficient permissions' };
            }
        }

        // Delete connection (cascades to associations and logs)
        await prisma.mCPConnection.delete({
            where: { id: connectionId }
        });

        return { success: true };
    }
}
