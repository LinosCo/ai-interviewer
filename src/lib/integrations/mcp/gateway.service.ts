/**
 * MCP Gateway Service
 * Orchestrates connections to WordPress and WooCommerce via MCP protocol
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '../encryption';
import { calculateCredits } from '../credits';
import { WordPressAdapter, type WordPressCredentials } from './wordpress.adapter';
import { WooCommerceAdapter, type WooCommerceCredentials } from './woocommerce.adapter';
import type { BaseMCPAdapter, MCPServerInfo, MCPTool, MCPCallResult } from './base.adapter';
import type { MCPConnection, MCPConnectionType } from '@prisma/client';

export interface TestConnectionResult {
  success: boolean;
  message: string;
  serverInfo?: MCPServerInfo;
}

export interface CallToolResult {
  success: boolean;
  data?: MCPCallResult;
  error?: string;
  creditsUsed: number;
  durationMs: number;
}

export interface DiscoverToolsResult {
  success: boolean;
  tools?: MCPTool[];
  error?: string;
}

class MCPGatewayServiceClass {
  /**
   * Create an adapter for a given connection
   */
  private createAdapter(connection: MCPConnection): BaseMCPAdapter {
    const credentials = JSON.parse(decrypt(connection.credentials));

    switch (connection.type) {
      case 'WORDPRESS':
        return new WordPressAdapter(
          connection.endpoint,
          credentials as WordPressCredentials
        );
      case 'WOOCOMMERCE':
        return new WooCommerceAdapter(
          connection.endpoint,
          credentials as WooCommerceCredentials
        );
      default:
        throw new Error(`Unknown connection type: ${connection.type}`);
    }
  }

  /**
   * Test a connection by initializing it
   */
  async testConnection(connectionId: string): Promise<TestConnectionResult> {
    const connection = await prisma.mCPConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return { success: false, message: 'Connection not found' };
    }

    const adapter = this.createAdapter(connection);

    try {
      const serverInfo = await adapter.initialize();
      await adapter.close();

      // Update connection status
      await prisma.mCPConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ACTIVE',
          lastPingAt: new Date(),
          lastError: null,
          serverVersion: serverInfo.version,
          serverName: serverInfo.name,
        },
      });

      return {
        success: true,
        message: 'Connection successful',
        serverInfo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update connection status
      await prisma.mCPConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ERROR',
          lastError: errorMessage,
        },
      });

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Discover available tools from a connection
   */
  async discoverTools(connectionId: string): Promise<DiscoverToolsResult> {
    const connection = await prisma.mCPConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    const adapter = this.createAdapter(connection);

    try {
      await adapter.initialize();
      const tools = await adapter.listTools();
      await adapter.close();

      // Update available tools
      await prisma.mCPConnection.update({
        where: { id: connectionId },
        data: {
          availableTools: tools.map(t => t.name),
          lastSyncAt: new Date(),
        },
      });

      return { success: true, tools };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Call a tool on a connection
   */
  async callTool(
    connectionId: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<CallToolResult> {
    const startTime = Date.now();

    const connection = await prisma.mCPConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return {
        success: false,
        error: 'Connection not found',
        creditsUsed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    if (connection.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Connection is not active',
        creditsUsed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const adapter = this.createAdapter(connection);
    const creditsUsed = calculateCredits(connection.type as MCPConnectionType, toolName);

    try {
      await adapter.initialize();
      const result = await adapter.callTool(toolName, args);
      await adapter.close();

      const durationMs = Date.now() - startTime;

      // Log the call
      await this.logCall({
        connectionId,
        action: `${connection.type.toLowerCase()}.${toolName}`,
        arguments: args,
        result,
        success: true,
        creditsUsed,
        durationMs,
      });

      return {
        success: true,
        data: result,
        creditsUsed,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const durationMs = Date.now() - startTime;

      // Log the failed call
      await this.logCall({
        connectionId,
        action: `${connection.type.toLowerCase()}.${toolName}`,
        arguments: args,
        success: false,
        errorMessage,
        creditsUsed: 0,
        durationMs,
      });

      return {
        success: false,
        error: errorMessage,
        creditsUsed: 0,
        durationMs,
      };
    }
  }

  /**
   * Log an integration call
   */
  private async logCall(data: {
    connectionId: string;
    action: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
    success: boolean;
    errorMessage?: string;
    creditsUsed: number;
    durationMs: number;
  }): Promise<void> {
    await prisma.integrationLog.create({
      data: {
        mcpConnectionId: data.connectionId,
        action: data.action,
        arguments: data.arguments ? JSON.parse(JSON.stringify(data.arguments)) : undefined,
        result: data.result ? JSON.parse(JSON.stringify(data.result)) : undefined,
        success: data.success,
        errorMessage: data.errorMessage,
        creditsUsed: data.creditsUsed,
        durationMs: data.durationMs,
      },
    });
  }

  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string) {
    return prisma.mCPConnection.findUnique({
      where: { id: connectionId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });
  }

  /**
   * Get all connections for a project
   */
  async getProjectConnections(projectId: string) {
    return prisma.mCPConnection.findMany({
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
        createdAt: true,
      },
    });
  }

  /**
   * Get recent logs for a connection
   */
  async getConnectionLogs(connectionId: string, limit: number = 50) {
    return prisma.integrationLog.findMany({
      where: { mcpConnectionId: connectionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// Export singleton instance
export const MCPGatewayService = new MCPGatewayServiceClass();
