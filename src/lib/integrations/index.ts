// Main integrations exports

// MCP (WordPress, WooCommerce)
export { MCPGatewayService } from './mcp';
export { WordPressAdapter, WooCommerceAdapter } from './mcp';
export { WORDPRESS_TOOLS, WOOCOMMERCE_TOOLS } from './mcp';

// Google (GA4, Search Console)
export { GoogleService } from './google';

// Utils
export { encrypt, decrypt } from './encryption';
export { calculateCredits, hasEnoughCredits } from './credits';

// Types
export type {
  MCPServerInfo,
  MCPTool,
  MCPCallResult,
  WordPressCredentials,
  WooCommerceCredentials,
  TestConnectionResult as MCPTestConnectionResult,
  CallToolResult,
  DiscoverToolsResult,
} from './mcp';

export type {
  GA4Metrics,
  GSCMetrics,
  TestConnectionResult as GoogleTestConnectionResult,
  DailyAnalytics,
} from './google';
