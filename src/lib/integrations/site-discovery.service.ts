/**
 * Site Discovery Service
 * Orchestrates site structure discovery for WordPress MCP, WooCommerce MCP,
 * and voler.ai CMS connections. Caches results in SiteStructureCache.
 */

import { prisma } from '@/lib/prisma';
import { MCPGatewayService } from '@/lib/integrations/mcp';
import { WORDPRESS_TOOLS } from '@/lib/integrations/mcp/wordpress.adapter';
import { WOOCOMMERCE_TOOLS } from '@/lib/integrations/mcp/woocommerce.adapter';
import type {
  SiteStructure,
  SitePage,
  SitePost,
  SiteCategory,
  SiteTag,
  SiteProduct,
  MediaItem,
  SiteInfo,
  ExistingContent,
  SiteAdapter,
} from './site-adapter';

const CACHE_TTL_HOURS = 24;

type ConnectionType = 'mcp' | 'cms';

// ---------------------------------------------------------------------------
// MCP result parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract an array from an MCP call result.
 * MCP responses wrap data in content[].text (JSON string) or content[].data.
 */
function extractArrayFromMcpResult(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== 'object') return [];

  const maybeData = data as Record<string, unknown>;
  const content = maybeData.content;
  if (!Array.isArray(content)) return [];

  const items: Array<Record<string, unknown>> = [];

  for (const entry of content) {
    if (!entry || typeof entry !== 'object') continue;
    const typed = entry as Record<string, unknown>;

    // Try content[].data (could be array or object)
    if (typed.data) {
      if (Array.isArray(typed.data)) {
        for (const item of typed.data) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            items.push(item as Record<string, unknown>);
          }
        }
      } else if (typeof typed.data === 'object') {
        items.push(typed.data as Record<string, unknown>);
      }
    }

    // Try content[].text (JSON string)
    if (typeof typed.text === 'string') {
      const text = typed.text.trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                items.push(item as Record<string, unknown>);
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            items.push(parsed as Record<string, unknown>);
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  }

  return items;
}

function str(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  return '';
}

function num(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// WordPress MCP Adapter
// ---------------------------------------------------------------------------

class WordPressMCPSiteAdapter implements SiteAdapter {
  constructor(private connectionId: string, private availableTools: string[]) {}

  private hasTool(tool: string): boolean {
    return this.availableTools.includes(tool);
  }

  private async callToolPaginated(
    toolName: string,
    extraArgs: Record<string, unknown> = {}
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.hasTool(toolName)) return [];

    const allItems: Array<Record<string, unknown>> = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const result = await MCPGatewayService.callTool(this.connectionId, toolName, {
        per_page: perPage,
        page,
        ...extraArgs,
      });

      if (!result.success || !result.data) break;

      const items = extractArrayFromMcpResult(result.data);
      if (items.length === 0) break;

      allItems.push(...items);

      // If we got fewer items than per_page, we've reached the end
      if (items.length < perPage) break;
      page++;

      // Safety limit
      if (page > 20) break;
    }

    return allItems;
  }

  async discoverStructure(): Promise<SiteStructure> {
    const [rawPages, rawPosts, rawCategories, rawTags, rawMedia] = await Promise.all([
      this.callToolPaginated(WORDPRESS_TOOLS.LIST_PAGES),
      this.callToolPaginated(WORDPRESS_TOOLS.LIST_POSTS),
      this.callToolPaginated(WORDPRESS_TOOLS.LIST_CATEGORIES),
      this.hasTool(WORDPRESS_TOOLS.LIST_TAGS)
        ? this.callToolPaginated(WORDPRESS_TOOLS.LIST_TAGS)
        : Promise.resolve([]),
      this.hasTool(WORDPRESS_TOOLS.LIST_MEDIA)
        ? this.callToolPaginated(WORDPRESS_TOOLS.LIST_MEDIA, { per_page: 50 })
        : Promise.resolve([]),
    ]);

    const pages: SitePage[] = rawPages.map((p) => ({
      id: str(p.id || p.ID),
      title: str(p.title?.toString() === '[object Object]'
        ? (p.title as Record<string, unknown>)?.rendered
        : p.title),
      slug: str(p.slug),
      status: str(p.status || 'publish'),
      template: str(p.template || ''),
      parentId: p.parent ? str(p.parent) : null,
      modified: str(p.modified || ''),
      url: str(p.link || ''),
    }));

    const posts: SitePost[] = rawPosts.map((p) => ({
      id: str(p.id || p.ID),
      title: str(p.title?.toString() === '[object Object]'
        ? (p.title as Record<string, unknown>)?.rendered
        : p.title),
      slug: str(p.slug),
      status: str(p.status || 'publish'),
      categories: Array.isArray(p.categories) ? p.categories.map(str) : [],
      tags: Array.isArray(p.tags) ? p.tags.map(str) : [],
      modified: str(p.modified || ''),
      url: str(p.link || ''),
      excerpt: str(p.excerpt?.toString() === '[object Object]'
        ? (p.excerpt as Record<string, unknown>)?.rendered
        : p.excerpt),
    }));

    const categories: SiteCategory[] = rawCategories.map((c) => ({
      id: str(c.id || c.ID),
      name: str(c.name),
      slug: str(c.slug),
      count: num(c.count),
      parentId: c.parent ? str(c.parent) : null,
    }));

    const tags: SiteTag[] = rawTags.map((t) => ({
      id: str(t.id || t.ID),
      name: str(t.name),
      slug: str(t.slug),
      count: num(t.count),
    }));

    const media: MediaItem[] = rawMedia.slice(0, 200).map((m) => ({
      id: str(m.id || m.ID),
      title: str(m.title?.toString() === '[object Object]'
        ? (m.title as Record<string, unknown>)?.rendered
        : m.title),
      altText: str(m.alt_text || ''),
      mimeType: str(m.mime_type || ''),
      url: str(m.source_url || m.link || ''),
    }));

    return { pages, posts, categories, tags, media };
  }

  async findCategoryByName(name: string): Promise<number | null> {
    if (!this.hasTool(WORDPRESS_TOOLS.LIST_CATEGORIES)) return null;
    const result = await MCPGatewayService.callTool(
      this.connectionId,
      WORDPRESS_TOOLS.LIST_CATEGORIES,
      { search: name, per_page: 5 }
    );
    if (!result.success || !result.data) return null;
    const items = extractArrayFromMcpResult(result.data);
    const match = items.find(
      (c) => str(c.name).toLowerCase() === name.toLowerCase()
    );
    return match ? (num(match.id ?? match.ID) ?? null) : null;
  }

  async findExistingContent(slug: string): Promise<ExistingContent | null> {
    // Try posts first
    if (this.hasTool(WORDPRESS_TOOLS.LIST_POSTS)) {
      const postResult = await MCPGatewayService.callTool(
        this.connectionId,
        WORDPRESS_TOOLS.LIST_POSTS,
        { slug, per_page: 1 }
      );
      if (postResult.success && postResult.data) {
        const items = extractArrayFromMcpResult(postResult.data);
        if (items.length > 0) {
          const p = items[0];
          return {
            id: str(p.id || p.ID),
            type: 'post',
            title: str(p.title?.toString() === '[object Object]'
              ? (p.title as Record<string, unknown>)?.rendered
              : p.title),
            slug: str(p.slug),
            url: str(p.link || ''),
          };
        }
      }
    }

    // Try pages
    if (this.hasTool(WORDPRESS_TOOLS.LIST_PAGES)) {
      const pageResult = await MCPGatewayService.callTool(
        this.connectionId,
        WORDPRESS_TOOLS.LIST_PAGES,
        { slug, per_page: 1 }
      );
      if (pageResult.success && pageResult.data) {
        const items = extractArrayFromMcpResult(pageResult.data);
        if (items.length > 0) {
          const p = items[0];
          return {
            id: str(p.id || p.ID),
            type: 'page',
            title: str(p.title?.toString() === '[object Object]'
              ? (p.title as Record<string, unknown>)?.rendered
              : p.title),
            slug: str(p.slug),
            url: str(p.link || ''),
          };
        }
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// WooCommerce MCP Adapter
// ---------------------------------------------------------------------------

class WooCommerceMCPSiteAdapter implements SiteAdapter {
  constructor(private connectionId: string, private availableTools: string[]) {}

  private hasTool(tool: string): boolean {
    return this.availableTools.includes(tool);
  }

  private async callToolPaginated(
    toolName: string,
    extraArgs: Record<string, unknown> = {}
  ): Promise<Array<Record<string, unknown>>> {
    if (!this.hasTool(toolName)) return [];

    const allItems: Array<Record<string, unknown>> = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const result = await MCPGatewayService.callTool(this.connectionId, toolName, {
        per_page: perPage,
        page,
        ...extraArgs,
      });

      if (!result.success || !result.data) break;
      const items = extractArrayFromMcpResult(result.data);
      if (items.length === 0) break;
      allItems.push(...items);
      if (items.length < perPage) break;
      page++;
      if (page > 20) break;
    }

    return allItems;
  }

  async discoverStructure(): Promise<SiteStructure> {
    const [rawProducts, rawCategories] = await Promise.all([
      this.callToolPaginated(WOOCOMMERCE_TOOLS.LIST_PRODUCTS),
      this.hasTool(WOOCOMMERCE_TOOLS.LIST_PRODUCT_CATEGORIES)
        ? this.callToolPaginated(WOOCOMMERCE_TOOLS.LIST_PRODUCT_CATEGORIES)
        : Promise.resolve([]),
    ]);

    const products: SiteProduct[] = rawProducts.map((p) => ({
      id: str(p.id || p.ID),
      name: str(p.name),
      slug: str(p.slug),
      status: str(p.status || 'publish'),
      sku: str(p.sku || ''),
      categories: Array.isArray(p.categories)
        ? p.categories.map((c: unknown) => {
            if (typeof c === 'object' && c !== null) return str((c as Record<string, unknown>).id);
            return str(c);
          })
        : [],
      price: str(p.price || p.regular_price || ''),
      type: str(p.type || 'simple'),
      modified: str(p.date_modified || ''),
      shortDescription: str(p.short_description || ''),
    }));

    const productCategories: SiteCategory[] = rawCategories.map((c) => ({
      id: str(c.id || c.ID),
      name: str(c.name),
      slug: str(c.slug),
      count: num(c.count),
      parentId: c.parent ? str(c.parent) : null,
    }));

    // WooCommerce adapter only populates products and product categories
    return {
      pages: [],
      posts: [],
      categories: [],
      tags: [],
      products,
      productCategories,
    };
  }

  async findCategoryByName(name: string): Promise<number | null> {
    if (!this.hasTool(WOOCOMMERCE_TOOLS.LIST_PRODUCT_CATEGORIES)) return null;
    const result = await MCPGatewayService.callTool(
      this.connectionId,
      WOOCOMMERCE_TOOLS.LIST_PRODUCT_CATEGORIES,
      { search: name, per_page: 5 }
    );
    if (!result.success || !result.data) return null;
    const items = extractArrayFromMcpResult(result.data);
    const match = items.find(
      (c) => str(c.name).toLowerCase() === name.toLowerCase()
    );
    return match ? (num(match.id ?? match.ID) ?? null) : null;
  }

  async findExistingContent(slug: string): Promise<ExistingContent | null> {
    if (!this.hasTool(WOOCOMMERCE_TOOLS.LIST_PRODUCTS)) return null;
    const result = await MCPGatewayService.callTool(
      this.connectionId,
      WOOCOMMERCE_TOOLS.LIST_PRODUCTS,
      { search: slug, per_page: 5 }
    );
    if (!result.success || !result.data) return null;
    const items = extractArrayFromMcpResult(result.data);
    const match = items.find(
      (p) => str(p.slug) === slug || str(p.name).toLowerCase().includes(slug.toLowerCase())
    );
    if (!match) return null;
    return {
      id: str(match.id || match.ID),
      type: 'product',
      title: str(match.name),
      slug: str(match.slug),
      url: str(match.permalink || ''),
    };
  }
}

// ---------------------------------------------------------------------------
// voler.ai CMS Adapter
// ---------------------------------------------------------------------------

class VolerCMSSiteAdapter implements SiteAdapter {
  constructor(
    private cmsApiUrl: string,
    private apiKey: string
  ) {}

  private async fetchEndpoint(path: string): Promise<Array<Record<string, unknown>>> {
    try {
      const url = `${this.cmsApiUrl.replace(/\/+$/, '')}${path}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-BT-API-Key': this.apiKey,
          'Accept': 'application/json',
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
      if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).items)) {
        return (data as Record<string, unknown>).items as Array<Record<string, unknown>>;
      }
      if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).data)) {
        return (data as Record<string, unknown>).data as Array<Record<string, unknown>>;
      }
      return [];
    } catch {
      return [];
    }
  }

  async discoverStructure(): Promise<SiteStructure> {
    const [rawPages, rawPosts, rawCategories] = await Promise.all([
      this.fetchEndpoint('/pages'),
      this.fetchEndpoint('/posts'),
      this.fetchEndpoint('/categories'),
    ]);

    const pages: SitePage[] = rawPages.map((p) => ({
      id: str(p.id || p._id),
      title: str(p.title),
      slug: str(p.slug),
      status: str(p.status || 'published'),
      template: str(p.template || ''),
      parentId: p.parentId ? str(p.parentId) : null,
      modified: str(p.updatedAt || p.modified || ''),
      url: str(p.url || ''),
    }));

    const posts: SitePost[] = rawPosts.map((p) => ({
      id: str(p.id || p._id),
      title: str(p.title),
      slug: str(p.slug),
      status: str(p.status || 'published'),
      categories: Array.isArray(p.categories) ? p.categories.map(str) : [],
      tags: Array.isArray(p.tags) ? p.tags.map(str) : [],
      modified: str(p.updatedAt || p.modified || ''),
      url: str(p.url || ''),
      excerpt: str(p.excerpt || p.metaDescription || ''),
    }));

    const categories: SiteCategory[] = rawCategories.map((c) => ({
      id: str(c.id || c._id),
      name: str(c.name),
      slug: str(c.slug),
      count: num(c.count),
      parentId: c.parentId ? str(c.parentId) : null,
    }));

    return { pages, posts, categories, tags: [] };
  }

  async findCategoryByName(name: string): Promise<number | null> {
    const categories = await this.fetchEndpoint(`/categories?search=${encodeURIComponent(name)}`);
    const match = categories.find(
      (c) => str(c.name).toLowerCase() === name.toLowerCase()
    );
    return match ? (num(match.id ?? match._id) ?? null) : null;
  }

  async findExistingContent(slug: string): Promise<ExistingContent | null> {
    // Try posts
    const posts = await this.fetchEndpoint(`/posts?slug=${encodeURIComponent(slug)}`);
    if (posts.length > 0) {
      const p = posts[0];
      return {
        id: str(p.id || p._id),
        type: 'post',
        title: str(p.title),
        slug: str(p.slug),
        url: str(p.url || ''),
      };
    }
    // Try pages
    const pages = await this.fetchEndpoint(`/pages?slug=${encodeURIComponent(slug)}`);
    if (pages.length > 0) {
      const p = pages[0];
      return {
        id: str(p.id || p._id),
        type: 'page',
        title: str(p.title),
        slug: str(p.slug),
        url: str(p.url || ''),
      };
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// SiteDiscoveryService (orchestrator)
// ---------------------------------------------------------------------------

export class SiteDiscoveryService {
  /**
   * Create the appropriate adapter for a connection
   */
  static async createAdapter(
    connectionType: ConnectionType,
    connectionId: string
  ): Promise<SiteAdapter | null> {
    if (connectionType === 'mcp') {
      const connection = await prisma.mCPConnection.findUnique({
        where: { id: connectionId },
        select: { id: true, type: true, availableTools: true, status: true },
      });
      if (!connection || connection.status !== 'ACTIVE') return null;

      if (connection.type === 'WORDPRESS') {
        return new WordPressMCPSiteAdapter(connectionId, connection.availableTools);
      }
      if (connection.type === 'WOOCOMMERCE') {
        return new WooCommerceMCPSiteAdapter(connectionId, connection.availableTools);
      }
      return null;
    }

    if (connectionType === 'cms') {
      const connection = await prisma.cMSConnection.findUnique({
        where: { id: connectionId },
        select: { id: true, cmsApiUrl: true, apiKey: true, status: true },
      });
      if (!connection || (connection.status !== 'ACTIVE' && connection.status !== 'PARTIAL')) {
        return null;
      }
      return new VolerCMSSiteAdapter(connection.cmsApiUrl, connection.apiKey);
    }

    return null;
  }

  /**
   * Discover site structure and persist to cache
   */
  static async discoverAndStore(
    connectionType: ConnectionType,
    connectionId: string
  ): Promise<SiteStructure | null> {
    const adapter = await this.createAdapter(connectionType, connectionId);
    if (!adapter) return null;

    const structure = await adapter.discoverStructure();

    // Serialize to plain JSON for Prisma InputJsonValue compatibility
    const toJson = <T>(val: T) => JSON.parse(JSON.stringify(val));

    const cacheData = {
      pages: toJson(structure.pages),
      posts: toJson(structure.posts),
      categories: toJson(structure.categories),
      tags: toJson(structure.tags),
      products: structure.products ? toJson(structure.products) : undefined,
      productCategories: structure.productCategories ? toJson(structure.productCategories) : undefined,
      media: structure.media ? toJson(structure.media) : undefined,
      siteInfo: structure.siteInfo ? toJson(structure.siteInfo) : undefined,
      discoveredAt: new Date(),
    };

    if (connectionType === 'mcp') {
      await prisma.siteStructureCache.upsert({
        where: { mcpConnectionId: connectionId },
        create: { mcpConnectionId: connectionId, ...cacheData },
        update: cacheData,
      });
    } else {
      await prisma.siteStructureCache.upsert({
        where: { cmsConnectionId: connectionId },
        create: { cmsConnectionId: connectionId, ...cacheData },
        update: cacheData,
      });
    }

    return structure;
  }

  /**
   * Get cached structure (returns null if no cache exists)
   */
  static async getCachedStructure(
    connectionType: ConnectionType,
    connectionId: string
  ): Promise<SiteStructure | null> {
    const where =
      connectionType === 'mcp'
        ? { mcpConnectionId: connectionId }
        : { cmsConnectionId: connectionId };

    const cache = await prisma.siteStructureCache.findUnique({ where });
    if (!cache) return null;

    return {
      pages: (cache.pages ?? []) as unknown as SitePage[],
      posts: (cache.posts ?? []) as unknown as SitePost[],
      categories: (cache.categories ?? []) as unknown as SiteCategory[],
      tags: (cache.tags ?? []) as unknown as SiteTag[],
      products: cache.products
        ? (cache.products as unknown as SiteProduct[])
        : undefined,
      productCategories: cache.productCategories
        ? (cache.productCategories as unknown as SiteCategory[])
        : undefined,
      media: cache.media
        ? (cache.media as unknown as MediaItem[])
        : undefined,
      siteInfo: cache.siteInfo
        ? (cache.siteInfo as unknown as SiteInfo)
        : undefined,
    };
  }

  /**
   * Check if the cached structure is stale (older than CACHE_TTL_HOURS)
   */
  static async isStale(
    connectionType: ConnectionType,
    connectionId: string
  ): Promise<boolean> {
    const where =
      connectionType === 'mcp'
        ? { mcpConnectionId: connectionId }
        : { cmsConnectionId: connectionId };

    const cache = await prisma.siteStructureCache.findUnique({
      where,
      select: { discoveredAt: true },
    });

    if (!cache) return true;

    const hoursSinceDiscovery =
      (Date.now() - cache.discoveredAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceDiscovery > CACHE_TTL_HOURS;
  }

  /**
   * Get or refresh cached structure (returns fresh data if stale)
   */
  static async getOrRefresh(
    connectionType: ConnectionType,
    connectionId: string
  ): Promise<SiteStructure | null> {
    const stale = await this.isStale(connectionType, connectionId);
    if (!stale) {
      const cached = await this.getCachedStructure(connectionType, connectionId);
      if (cached) return cached;
    }
    return this.discoverAndStore(connectionType, connectionId);
  }

  /**
   * Get combined site structure for a project (merges WP + WooCommerce + CMS caches)
   */
  static async getProjectStructure(projectId: string): Promise<SiteStructure | null> {
    // Find all MCP connections for the project
    const mcpConnections = await prisma.mCPConnection.findMany({
      where: { projectId, status: 'ACTIVE' },
      select: { id: true, type: true },
    });

    // Find CMS connection for the project
    const cmsConnection = await prisma.cMSConnection.findFirst({
      where: { projectId, status: { in: ['ACTIVE', 'PARTIAL'] } },
      select: { id: true },
    });

    const merged: SiteStructure = {
      pages: [],
      posts: [],
      categories: [],
      tags: [],
      products: [],
      productCategories: [],
      media: [],
    };

    // Merge all cached structures
    for (const conn of mcpConnections) {
      const structure = await this.getCachedStructure('mcp', conn.id);
      if (!structure) continue;

      merged.pages.push(...structure.pages);
      merged.posts.push(...structure.posts);
      merged.categories.push(...structure.categories);
      merged.tags.push(...structure.tags);
      if (structure.products) merged.products!.push(...structure.products);
      if (structure.productCategories) merged.productCategories!.push(...structure.productCategories);
      if (structure.media) merged.media!.push(...structure.media);
      if (structure.siteInfo && !merged.siteInfo) merged.siteInfo = structure.siteInfo;
    }

    if (cmsConnection) {
      const structure = await this.getCachedStructure('cms', cmsConnection.id);
      if (structure) {
        merged.pages.push(...structure.pages);
        merged.posts.push(...structure.posts);
        merged.categories.push(...structure.categories);
        merged.tags.push(...structure.tags);
        if (structure.media) merged.media!.push(...structure.media);
        if (structure.siteInfo && !merged.siteInfo) merged.siteInfo = structure.siteInfo;
      }
    }

    const hasData =
      merged.pages.length > 0 ||
      merged.posts.length > 0 ||
      merged.categories.length > 0 ||
      (merged.products && merged.products.length > 0);

    return hasData ? merged : null;
  }
}
