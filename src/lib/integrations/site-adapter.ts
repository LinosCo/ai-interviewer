/**
 * Site Adapter Interface
 * Common abstraction for site structure discovery across WordPress MCP,
 * WooCommerce MCP, and voler.ai CMS connections.
 */

export interface SitePage {
  id: string | number;
  title: string;
  slug: string;
  status: string;
  template?: string;
  parentId?: string | number | null;
  modified?: string;
  url?: string;
}

export interface SitePost {
  id: string | number;
  title: string;
  slug: string;
  status: string;
  categories?: Array<string | number>;
  tags?: Array<string | number>;
  modified?: string;
  url?: string;
  excerpt?: string;
}

export interface SiteCategory {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
  parentId?: string | number | null;
}

export interface SiteTag {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
}

export interface SiteProduct {
  id: string | number;
  name: string;
  slug: string;
  status: string;
  sku?: string;
  categories?: Array<string | number>;
  price?: string;
  type?: string;
  modified?: string;
  shortDescription?: string;
}

export interface MediaItem {
  id: string | number;
  title?: string;
  altText?: string;
  mimeType?: string;
  url?: string;
}

export interface SiteInfo {
  name?: string;
  url?: string;
  description?: string;
  language?: string;
}

export interface SiteStructure {
  pages: SitePage[];
  posts: SitePost[];
  categories: SiteCategory[];
  tags: SiteTag[];
  products?: SiteProduct[];
  productCategories?: SiteCategory[];
  media?: MediaItem[];
  siteInfo?: SiteInfo;
}

export interface ExistingContent {
  id: string | number;
  type: 'post' | 'page' | 'product';
  title: string;
  slug: string;
  url?: string;
}

export interface SiteAdapter {
  discoverStructure(): Promise<SiteStructure>;
  findCategoryByName(name: string): Promise<number | null>;
  findExistingContent(slug: string): Promise<ExistingContent | null>;
}
