/**
 * TipRoutingExecutor
 *
 * Dispatches AI tips to configured destinations based on TipRoutingRule records.
 * Supports three destination types:
 *   - MCP (WordPress / WooCommerce) via MCPGatewayService.callTool()
 *   - CMS (Voler API) via N8NDispatcher.dispatchTips()
 *   - n8n Webhook via N8NDispatcher.dispatchTips()
 *
 * Non-blocking per rule: individual failures are logged but do not stop other rules.
 */

import { prisma } from '@/lib/prisma';
import { MCPGatewayService } from '@/lib/integrations/mcp/gateway.service';
import { N8NDispatcher, type TipPayload } from '@/lib/integrations/n8n/dispatcher';

interface TipInput {
  id: string;
  title: string;
  content: string;
  contentKind: string;
  targetChannel?: string;
  metaDescription?: string;
  url?: string;
}

interface ExecutionResult {
  ruleId: string;
  contentKind: string;
  destination: 'mcp' | 'cms' | 'n8n';
  success: boolean;
  error?: string;
}

export class TipRoutingExecutor {
  /**
   * Execute all enabled routing rules for the project on the given tips.
   * Tips are filtered per rule by contentKind match.
   */
  static async execute(
    projectId: string,
    tips: TipInput[]
  ): Promise<ExecutionResult[]> {
    if (!tips.length) return [];

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId, enabled: true },
      include: {
        mcpConnection: { select: { id: true, status: true } },
        cmsConnection: { select: { id: true, status: true } },
        n8nConnection: { select: { id: true, status: true } },
      },
      orderBy: { priority: 'desc' },
    });

    if (!rules.length) return [];

    const results: ExecutionResult[] = [];

    for (const rule of rules) {
      const matchingTips = tips.filter(t => t.contentKind === rule.contentKind);
      if (!matchingTips.length) continue;

      try {
        if (rule.mcpConnectionId && rule.mcpConnection?.status === 'ACTIVE' && rule.mcpTool) {
          // MCP destination (WordPress / WooCommerce)
          for (const tip of matchingTips) {
            const args: Record<string, unknown> = {
              title: tip.title,
              content: tip.content,
              ...(rule.behaviorConfig && typeof rule.behaviorConfig === 'object'
                ? (rule.behaviorConfig as Record<string, unknown>)
                : {}),
            };
            await MCPGatewayService.callTool(
              rule.mcpConnectionId,
              rule.mcpTool,
              args
            );
          }
          results.push({
            ruleId: rule.id,
            contentKind: rule.contentKind,
            destination: 'mcp',
            success: true,
          });

        } else if (rule.cmsConnectionId && rule.cmsConnection?.status === 'ACTIVE') {
          // CMS destination
          const payload: TipPayload[] = matchingTips.map(t => ({
            id: t.id,
            title: t.title,
            content: t.content,
            contentKind: t.contentKind,
            targetChannel: t.targetChannel,
            metaDescription: t.metaDescription,
            url: t.url,
          }));
          await N8NDispatcher.dispatchTips(projectId, payload);
          results.push({
            ruleId: rule.id,
            contentKind: rule.contentKind,
            destination: 'cms',
            success: true,
          });

        } else if (rule.n8nConnectionId && rule.n8nConnection?.status === 'ACTIVE') {
          // n8n destination
          const payload: TipPayload[] = matchingTips.map(t => ({
            id: t.id,
            title: t.title,
            content: t.content,
            contentKind: t.contentKind,
            targetChannel: t.targetChannel,
            metaDescription: t.metaDescription,
            url: t.url,
          }));
          await N8NDispatcher.dispatchTips(projectId, payload);
          results.push({
            ruleId: rule.id,
            contentKind: rule.contentKind,
            destination: 'n8n',
            success: true,
          });

        } else {
          const destination = rule.mcpConnectionId ? 'mcp' : rule.cmsConnectionId ? 'cms' : 'n8n';
          results.push({
            ruleId: rule.id,
            contentKind: rule.contentKind,
            destination,
            success: false,
            error: 'Connection not active or missing MCP tool name',
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[TipRoutingExecutor] Rule ${rule.id} failed:`, errorMsg);
        const destination = rule.mcpConnectionId ? 'mcp' : rule.cmsConnectionId ? 'cms' : 'n8n';
        results.push({
          ruleId: rule.id,
          contentKind: rule.contentKind,
          destination,
          success: false,
          error: errorMsg,
        });
      }
    }

    return results;
  }
}
