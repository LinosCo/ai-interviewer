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
import type { TipRoutingRule } from '@prisma/client';
import { type CMSSuggestionType, type TipRouteDestinationType } from '@prisma/client';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { ProjectTipService } from '@/lib/projects/project-tip.service';

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

type RoutingDestination = ExecutionResult['destination'];

type RuleWithConnections = TipRoutingRule & {
  mcpConnection: { id: string; status: string } | null;
  cmsConnection: { id: string; status: string } | null;
  n8nConnection: { id: string; status: string } | null;
};

export class TipRoutingExecutor {
  private static toCanonicalDestinationType(destination: RoutingDestination): TipRouteDestinationType {
    if (destination === 'mcp') return 'MCP';
    if (destination === 'cms') return 'CMS';
    return 'N8N';
  }

  private static getDestinationRefId(rule: RuleWithConnections, destination: RoutingDestination): string | null {
    if (destination === 'mcp') return rule.mcpConnectionId ?? null;
    if (destination === 'cms') return rule.cmsConnectionId ?? null;
    return rule.n8nConnectionId ?? null;
  }

  /**
   * For canonical ProjectTip records, write route+execution rows alongside the integrationLog.
   * Non-blocking: failures are logged but do not abort dispatch.
   */
  private static async writeCanonicalRoutingStart(
    tips: TipInput[],
    rule: RuleWithConnections,
    destination: RoutingDestination,
    source: 'cron' | 'manual_test'
  ): Promise<Map<string, { routeId: string; executionId: string }>> {
    const canonicalMap = new Map<string, { routeId: string; executionId: string }>();
    const destinationType = this.toCanonicalDestinationType(destination);
    const destinationRefId = this.getDestinationRefId(rule, destination);
    const runType = source === 'manual_test' ? 'MANUAL' : 'AUTOMATIC';

    for (const tip of tips) {
      // Only write canonical rows if this tip is a real ProjectTip record
      const canonicalTip = await prisma.projectTip.findUnique({
        where: { id: tip.id },
        select: { id: true },
      });
      if (!canonicalTip) continue;

      try {
        const routeId = await ProjectTipService.upsertRoute({
          tipId: tip.id,
          destinationType,
          destinationRefId,
          policyMode: 'AUTO_EXECUTE',
          payloadPreview: { ruleId: rule.id, contentKind: tip.contentKind, title: tip.title },
        });
        const executionId = await ProjectTipService.openExecution({
          tipId: tip.id,
          routeId,
          runType,
          requestPayload: { ruleId: rule.id, destination, contentKind: tip.contentKind },
        });
        canonicalMap.set(tip.id, { routeId, executionId });
      } catch (err) {
        console.warn(`[TipRoutingExecutor] canonical write start failed for tip ${tip.id}:`, err);
      }
    }

    return canonicalMap;
  }

  private static async writeCanonicalRoutingSuccess(
    canonicalMap: Map<string, { routeId: string; executionId: string }>,
    durationMs: number,
    destination: RoutingDestination
  ): Promise<void> {
    for (const [, { routeId, executionId }] of canonicalMap) {
      try {
        await ProjectTipService.markExecutionSuccess({
          executionId,
          routeId,
          responsePayload: { destination, durationMs },
        });
      } catch (err) {
        console.warn(`[TipRoutingExecutor] canonical write success failed for execution ${executionId}:`, err);
      }
    }
  }

  private static async writeCanonicalRoutingFailure(
    canonicalMap: Map<string, { routeId: string; executionId: string }>,
    error: string
  ): Promise<void> {
    for (const [, { routeId, executionId }] of canonicalMap) {
      try {
        await ProjectTipService.markExecutionFailure({
          executionId,
          routeId,
          errorMessage: error,
        });
      } catch (err) {
        console.warn(`[TipRoutingExecutor] canonical write failure failed for execution ${executionId}:`, err);
      }
    }
  }

  private static mapContentKindToSuggestionType(contentKind: string): CMSSuggestionType {
    const kind = String(contentKind || '').toUpperCase();
    if (kind === 'NEW_FAQ') return 'CREATE_FAQ';
    if (kind === 'BLOG_POST' || kind === 'BLOG_UPDATE') return 'CREATE_BLOG_POST';
    if (kind === 'NEW_PAGE') return 'CREATE_PAGE';
    return 'MODIFY_CONTENT';
  }

  private static toPayload(tips: TipInput[]): TipPayload[] {
    return tips.map((t) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      contentKind: t.contentKind,
      targetChannel: t.targetChannel,
      metaDescription: t.metaDescription,
      url: t.url,
    }));
  }

  private static getDestination(rule: TipRoutingRule): RoutingDestination {
    if (rule.mcpConnectionId) return 'mcp';
    if (rule.cmsConnectionId) return 'cms';
    return 'n8n';
  }

  private static async logRoutingExecution(params: {
    projectId: string;
    rule: TipRoutingRule;
    destination: RoutingDestination;
    success: boolean;
    tips: TipInput[];
    durationMs: number;
    error?: string;
    source: 'cron' | 'manual_test';
  }): Promise<void> {
    const { rule, success, tips, durationMs, error, source, projectId, destination } = params;
    const action = source === 'manual_test'
      ? `tip_routing.test.${destination}`
      : `tip_routing.dispatch.${destination}`;

    await prisma.integrationLog.create({
      data: {
        mcpConnectionId: destination === 'mcp' ? rule.mcpConnectionId : null,
        cmsConnectionId: destination === 'cms' ? rule.cmsConnectionId : null,
        action,
        arguments: {
          source,
          projectId,
          ruleId: rule.id,
          contentKind: rule.contentKind,
          behavior: rule.behavior,
          tipIds: tips.map((tip) => tip.id),
          tipsCount: tips.length,
          n8nConnectionId: rule.n8nConnectionId,
          mcpTool: rule.mcpTool,
        },
        result: success
          ? { status: 'ok', destination }
          : { status: 'error', destination, error },
        success,
        errorMessage: error || null,
        creditsUsed: 0,
        durationMs,
      },
    });
  }

  private static async executeRule(
    projectId: string,
    rule: RuleWithConnections,
    tips: TipInput[],
    source: 'cron' | 'manual_test' = 'cron'
  ): Promise<ExecutionResult> {
    const destination = this.getDestination(rule);
    const startedAt = Date.now();
    const canonicalMap = await this.writeCanonicalRoutingStart(tips, rule, destination, source);

    try {
      if (destination === 'mcp') {
        if (rule.mcpConnection?.status !== 'ACTIVE' || !rule.mcpTool || !rule.mcpConnectionId) {
          throw new Error('MCP connection not active or MCP tool missing');
        }

        for (const tip of tips) {
          const args: Record<string, unknown> = {
            title: tip.title,
            content: tip.content,
            ...(rule.behaviorConfig && typeof rule.behaviorConfig === 'object'
              ? (rule.behaviorConfig as Record<string, unknown>)
              : {}),
          };

          const call = await MCPGatewayService.callTool(rule.mcpConnectionId, rule.mcpTool, args);
          if (!call.success) {
            throw new Error(call.error || `MCP tool ${rule.mcpTool} returned an error`);
          }
        }
      } else if (destination === 'cms') {
        if (rule.cmsConnection?.status !== 'ACTIVE' || !rule.cmsConnectionId) {
          throw new Error('CMS connection is not active');
        }

        for (const tip of tips) {
          const existingSuggestion = await prisma.cMSSuggestion.findUnique({
            where: { id: tip.id },
            select: { id: true, connectionId: true, status: true },
          });

          let suggestionId = tip.id;
          if (!existingSuggestion || existingSuggestion.connectionId !== rule.cmsConnectionId) {
            const created = await prisma.cMSSuggestion.create({
              data: {
                connectionId: rule.cmsConnectionId,
                type: this.mapContentKindToSuggestionType(tip.contentKind),
                title: tip.title,
                body: tip.content,
                reasoning: `Routing automatico ${source === 'manual_test' ? 'test' : 'cron'} da regola ${rule.id}`,
                sourceSignals: {
                  projectId,
                  routedBy: 'tip_routing',
                  routingRuleId: rule.id,
                  publishRouting: {
                    contentKind: tip.contentKind,
                  },
                },
                targetSection: tip.targetChannel || null,
                metaDescription: tip.metaDescription || null,
                status: 'PENDING',
                createdBy: source === 'manual_test' ? 'routing_test' : 'routing_executor',
              },
            });
            suggestionId = created.id;
          }

          const push = await CMSConnectionService.pushSuggestion(suggestionId);
          if (!push.success) {
            throw new Error(push.error || 'CMS push failed');
          }
        }
      } else {
        if (rule.n8nConnection?.status !== 'ACTIVE') {
          throw new Error('N8N connection is not active');
        }

        const dispatch = await N8NDispatcher.dispatchTipsWithResult(projectId, this.toPayload(tips));
        if (!dispatch.attempted || !dispatch.success) {
          throw new Error(dispatch.error || 'Webhook dispatch failed');
        }
      }

      const durationMs = Date.now() - startedAt;
      await this.logRoutingExecution({
        projectId,
        rule,
        destination,
        success: true,
        tips,
        durationMs,
        source,
      });
      await this.writeCanonicalRoutingSuccess(canonicalMap, durationMs, destination);

      return {
        ruleId: rule.id,
        contentKind: rule.contentKind,
        destination,
        success: true,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      const durationMs = Date.now() - startedAt;
      await this.logRoutingExecution({
        projectId,
        rule,
        destination,
        success: false,
        tips,
        durationMs,
        error,
        source,
      });
      await this.writeCanonicalRoutingFailure(canonicalMap, error);
      return {
        ruleId: rule.id,
        contentKind: rule.contentKind,
        destination,
        success: false,
        error,
      };
    }
  }

  /**
   * Execute all enabled routing rules for the project on the given tips.
   * Tips are filtered per rule by contentKind match.
   */
  static async execute(
    projectId: string,
    tips: TipInput[]
  ): Promise<ExecutionResult[]> {
    if (!tips.length) return [];

    const rules: RuleWithConnections[] = await prisma.tipRoutingRule.findMany({
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
      const matchingTips = tips.filter((t) => t.contentKind === rule.contentKind);
      if (!matchingTips.length) continue;
      const execution = await this.executeRule(projectId, rule, matchingTips, 'cron');
      if (!execution.success) {
        console.warn(`[TipRoutingExecutor] Rule ${rule.id} failed:`, execution.error);
      }
      results.push(execution);
    }

    return results;
  }

  static async testRule(
    projectId: string,
    ruleId: string,
    sampleTip?: Partial<TipInput>
  ): Promise<ExecutionResult> {
    const rule = await prisma.tipRoutingRule.findUnique({
      where: { id: ruleId },
      include: {
        mcpConnection: { select: { id: true, status: true } },
        cmsConnection: { select: { id: true, status: true } },
        n8nConnection: { select: { id: true, status: true } },
      },
    }) as RuleWithConnections | null;

    if (!rule || rule.projectId !== projectId) {
      return {
        ruleId,
        contentKind: sampleTip?.contentKind || 'unknown',
        destination: 'n8n',
        success: false,
        error: 'Rule not found for project',
      };
    }

    const fallbackTip: TipInput = {
      id: `routing-test-${Date.now()}`,
      title: `Routing test ${new Date().toLocaleString('it-IT')}`,
      content: `Test automatico matching regola ${rule.id} su contentKind ${rule.contentKind}.`,
      contentKind: rule.contentKind,
      targetChannel: 'routing_test',
      metaDescription: 'Test routing effettivo BT -> tool esterno',
      url: undefined,
    };

    const mergedTip: TipInput = {
      id: sampleTip?.id || fallbackTip.id,
      title: sampleTip?.title || fallbackTip.title,
      content: sampleTip?.content || fallbackTip.content,
      contentKind: sampleTip?.contentKind || rule.contentKind,
      targetChannel: sampleTip?.targetChannel || fallbackTip.targetChannel,
      metaDescription: sampleTip?.metaDescription || fallbackTip.metaDescription,
      url: sampleTip?.url || fallbackTip.url,
    };

    return this.executeRule(projectId, rule, [mergedTip], 'manual_test');
  }
}
