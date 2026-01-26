/**
 * Credits calculation for integration operations
 */

const CREDITS_MAP: Record<string, number> = {
  // Free operations
  'test': 0,

  // Discovery
  'discover': 100,

  // Google - Read
  'ga4.run_report': 500,
  'ga4.run_realtime_report': 500,
  'ga4.get_property_details': 200,
  'gsc.search_analytics': 500,
  'gsc.inspect_url': 300,
  'gsc.list_sitemaps': 200,

  // WordPress/Woo - Read
  'wordpress.list_posts': 200,
  'wordpress.get_post': 200,
  'wordpress.list_pages': 200,
  'woocommerce.list_products': 200,
  'woocommerce.get_product': 200,
  'woocommerce.list_orders': 200,

  // WordPress/Woo - Write
  'wordpress.create_post': 1000,
  'wordpress.update_post': 1000,
  'wordpress.create_page': 1000,
  'wordpress.update_page': 1000,
  'woocommerce.create_product': 1000,
  'woocommerce.update_product': 1000,

  // Defaults
  'default_read': 300,
  'default_write': 1000,
};

/**
 * Calculate credits for a given operation
 */
export function calculateCredits(
  connectionType: 'WORDPRESS' | 'WOOCOMMERCE' | 'GOOGLE_ANALYTICS' | 'GOOGLE_SEARCH_CONSOLE',
  toolName: string
): number {
  // Build key based on connection type
  const typePrefix = connectionType.toLowerCase().replace('_', '');
  const key = `${typePrefix}.${toolName}`;

  // Check exact match
  if (CREDITS_MAP[key]) {
    return CREDITS_MAP[key];
  }

  // Check pattern matches
  for (const [pattern, credits] of Object.entries(CREDITS_MAP)) {
    if (toolName.toLowerCase().includes(pattern.split('.').pop() || '')) {
      return credits;
    }
  }

  // Default based on operation type
  const isWrite = ['create', 'update', 'delete', 'publish'].some(
    op => toolName.toLowerCase().includes(op)
  );

  return isWrite ? CREDITS_MAP['default_write'] : CREDITS_MAP['default_read'];
}

/**
 * Check if user has enough credits for an operation
 */
export function hasEnoughCredits(
  availableCredits: number,
  connectionType: 'WORDPRESS' | 'WOOCOMMERCE' | 'GOOGLE_ANALYTICS' | 'GOOGLE_SEARCH_CONSOLE',
  toolName: string
): boolean {
  const needed = calculateCredits(connectionType, toolName);
  return availableCredits >= needed;
}
