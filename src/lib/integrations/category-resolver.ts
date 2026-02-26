/**
 * Category & Tag Resolver Service
 *
 * Resolves category/tag names to WordPress or WooCommerce IDs.
 * Strategy: cache lookup first, then MCP call, then create if missing.
 * Graceful degradation: if creation tools are unavailable, skip silently.
 */

import { prisma } from '@/lib/prisma';
import { MCPGatewayService } from '@/lib/integrations/mcp/gateway.service';
import { WORDPRESS_TOOLS } from '@/lib/integrations/mcp/wordpress.adapter';
import type { SiteCategory } from '@/lib/integrations/site-adapter';

interface ResolvedId {
    name: string;
    id: number;
    created: boolean;
}

function extractIdFromMcpResult(data: unknown): number | null {
    if (!data || typeof data !== 'object') return null;
    const maybeData = data as Record<string, unknown>;
    const content = maybeData.content;
    if (!Array.isArray(content)) return null;

    for (const entry of content) {
        if (!entry || typeof entry !== 'object') continue;
        const typed = entry as Record<string, unknown>;

        // Try data as object with id
        if (typed.data && typeof typed.data === 'object' && !Array.isArray(typed.data)) {
            const id = (typed.data as Record<string, unknown>).id;
            if (typeof id === 'number') return id;
            if (typeof id === 'string' && !isNaN(Number(id))) return Number(id);
        }

        // Try text as JSON
        if (typeof typed.text === 'string') {
            try {
                const parsed = JSON.parse(typed.text);
                if (typeof parsed?.id === 'number') return parsed.id;
            } catch { /* ignore parse errors */ }
        }
    }
    return null;
}

export class CategoryResolver {
    /**
     * Resolve an array of category names to WordPress category IDs.
     * Uses cached SiteStructureCache first, then falls back to MCP calls.
     */
    static async resolveWordPressCategories(
        connectionId: string,
        names: string[]
    ): Promise<ResolvedId[]> {
        if (!names.length) return [];

        const resolved: ResolvedId[] = [];
        const unresolved: string[] = [];

        // Step 1: Try cache first
        const cache = await this.getCachedCategories(connectionId);
        for (const name of names) {
            const cached = cache.find(c => c.name.toLowerCase() === name.toLowerCase());
            if (cached && typeof cached.id === 'number') {
                resolved.push({ name, id: cached.id, created: false });
            } else {
                unresolved.push(name);
            }
        }

        if (unresolved.length === 0) return resolved;

        // Step 2: Check available tools
        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            select: { availableTools: true }
        });
        const tools = Array.isArray(connection?.availableTools)
            ? (connection.availableTools as string[])
            : [];
        const canList = tools.includes(WORDPRESS_TOOLS.LIST_CATEGORIES);
        const canCreate = tools.includes(WORDPRESS_TOOLS.CREATE_CATEGORY);

        // Step 3: Try to find via MCP list
        for (const name of unresolved) {
            if (canList) {
                try {
                    const result = await MCPGatewayService.callTool(
                        connectionId,
                        WORDPRESS_TOOLS.LIST_CATEGORIES,
                        { search: name, per_page: 5 }
                    );
                    if (result.success && result.data) {
                        const id = this.findCategoryInResult(result.data, name);
                        if (id !== null) {
                            resolved.push({ name, id, created: false });
                            continue;
                        }
                    }
                } catch (err) {
                    console.warn(`CategoryResolver: Failed to search WP category "${name}":`, err);
                }
            }

            // Step 4: Create if not found and tool available
            if (canCreate) {
                try {
                    const createResult = await MCPGatewayService.callTool(
                        connectionId,
                        WORDPRESS_TOOLS.CREATE_CATEGORY,
                        { name }
                    );
                    if (createResult.success && createResult.data) {
                        const newId = extractIdFromMcpResult(createResult.data);
                        if (newId !== null) {
                            resolved.push({ name, id: newId, created: true });
                            continue;
                        }
                    }
                } catch (err) {
                    console.warn(`CategoryResolver: Failed to create WP category "${name}":`, err);
                }
            }

            // Skip this category — graceful degradation
        }

        return resolved;
    }

    /**
     * Resolve an array of tag names to WordPress tag IDs.
     */
    static async resolveWordPressTags(
        connectionId: string,
        names: string[]
    ): Promise<ResolvedId[]> {
        if (!names.length) return [];

        const resolved: ResolvedId[] = [];
        const unresolved: string[] = [];

        // Step 1: Try cache first
        const cache = await this.getCachedTags(connectionId);
        for (const name of names) {
            const cached = cache.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (cached && typeof cached.id === 'number') {
                resolved.push({ name, id: cached.id, created: false });
            } else {
                unresolved.push(name);
            }
        }

        if (unresolved.length === 0) return resolved;

        const connection = await prisma.mCPConnection.findUnique({
            where: { id: connectionId },
            select: { availableTools: true }
        });
        const tools = Array.isArray(connection?.availableTools)
            ? (connection.availableTools as string[])
            : [];
        const canList = tools.includes(WORDPRESS_TOOLS.LIST_TAGS);
        const canCreate = tools.includes(WORDPRESS_TOOLS.CREATE_TAG);

        for (const name of unresolved) {
            if (canList) {
                try {
                    const result = await MCPGatewayService.callTool(
                        connectionId,
                        WORDPRESS_TOOLS.LIST_TAGS,
                        { search: name, per_page: 5 }
                    );
                    if (result.success && result.data) {
                        const id = this.findCategoryInResult(result.data, name);
                        if (id !== null) {
                            resolved.push({ name, id, created: false });
                            continue;
                        }
                    }
                } catch (err) {
                    console.warn(`CategoryResolver: Failed to search WP tag "${name}":`, err);
                }
            }

            if (canCreate) {
                try {
                    const createResult = await MCPGatewayService.callTool(
                        connectionId,
                        WORDPRESS_TOOLS.CREATE_TAG,
                        { name }
                    );
                    if (createResult.success && createResult.data) {
                        const newId = extractIdFromMcpResult(createResult.data);
                        if (newId !== null) {
                            resolved.push({ name, id: newId, created: true });
                            continue;
                        }
                    }
                } catch (err) {
                    console.warn(`CategoryResolver: Failed to create WP tag "${name}":`, err);
                }
            }
        }

        return resolved;
    }

    /**
     * Resolve WooCommerce product category names to IDs.
     * Uses the same SiteStructureCache but for product categories.
     */
    static async resolveWooCommerceCategories(
        connectionId: string,
        names: string[]
    ): Promise<ResolvedId[]> {
        if (!names.length) return [];

        const resolved: ResolvedId[] = [];

        // WooCommerce product categories are cached in SiteStructureCache.productCategories
        const cache = await prisma.siteStructureCache.findUnique({
            where: { mcpConnectionId: connectionId },
            select: { productCategories: true }
        });

        const productCategories = Array.isArray(cache?.productCategories)
            ? (cache.productCategories as Array<Record<string, unknown>>)
            : [];

        for (const name of names) {
            const cached = productCategories.find(
                c => typeof c.name === 'string' && c.name.toLowerCase() === name.toLowerCase()
            );
            if (cached) {
                const id = typeof cached.id === 'number' ? cached.id : Number(cached.id);
                if (!isNaN(id)) {
                    resolved.push({ name, id, created: false });
                }
            }
            // WooCommerce category creation via MCP is not widely supported yet — skip
        }

        return resolved;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static async getCachedCategories(connectionId: string): Promise<SiteCategory[]> {
        const cache = await prisma.siteStructureCache.findUnique({
            where: { mcpConnectionId: connectionId },
            select: { categories: true }
        });
        if (!cache?.categories || !Array.isArray(cache.categories)) return [];
        return cache.categories as unknown as SiteCategory[];
    }

    private static async getCachedTags(connectionId: string): Promise<Array<{ id: string | number; name: string; slug: string }>> {
        const cache = await prisma.siteStructureCache.findUnique({
            where: { mcpConnectionId: connectionId },
            select: { tags: true }
        });
        if (!cache?.tags || !Array.isArray(cache.tags)) return [];
        return cache.tags as unknown as Array<{ id: string | number; name: string; slug: string }>;
    }

    /**
     * Search through MCP list result for a category/tag by name (case-insensitive).
     */
    private static findCategoryInResult(data: unknown, name: string): number | null {
        if (!data || typeof data !== 'object') return null;
        const maybeData = data as Record<string, unknown>;
        const content = maybeData.content;
        if (!Array.isArray(content)) return null;

        for (const entry of content) {
            if (!entry || typeof entry !== 'object') continue;
            const typed = entry as Record<string, unknown>;

            let items: Array<Record<string, unknown>> = [];

            if (Array.isArray(typed.data)) {
                items = typed.data.filter(
                    (i): i is Record<string, unknown> => i !== null && typeof i === 'object'
                );
            } else if (typeof typed.text === 'string') {
                try {
                    const parsed = JSON.parse(typed.text);
                    if (Array.isArray(parsed)) {
                        items = parsed.filter(
                            (i): i is Record<string, unknown> => i !== null && typeof i === 'object'
                        );
                    }
                } catch { /* ignore */ }
            }

            for (const item of items) {
                const itemName = typeof item.name === 'string' ? item.name : '';
                if (itemName.toLowerCase() === name.toLowerCase()) {
                    const id = item.id;
                    if (typeof id === 'number') return id;
                    if (typeof id === 'string' && !isNaN(Number(id))) return Number(id);
                }
            }
        }

        return null;
    }
}
