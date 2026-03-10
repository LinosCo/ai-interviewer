// MCP Integration exports

export { MCPGatewayService } from './gateway.service';
export { BaseMCPAdapter } from './base.adapter';
export { WordPressAdapter, WORDPRESS_TOOLS } from './wordpress.adapter';
export { WooCommerceAdapter, WOOCOMMERCE_TOOLS } from './woocommerce.adapter';
export { BrevoAdapter, BREVO_TOOLS } from './brevo.adapter';

export type { MCPServerInfo, MCPTool, MCPCallResult } from './base.adapter';
export type { WordPressCredentials } from './wordpress.adapter';
export type { WooCommerceCredentials } from './woocommerce.adapter';
export type { BrevoCredentials } from './brevo.adapter';
export type {
  TestConnectionResult,
  CallToolResult,
  DiscoverToolsResult,
} from './gateway.service';
