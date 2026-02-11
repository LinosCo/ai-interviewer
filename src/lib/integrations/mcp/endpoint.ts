import type { MCPConnectionType } from '@prisma/client';

const DEFAULT_MCP_PATH: Partial<Record<MCPConnectionType, string>> = {
  WORDPRESS: '/wp-json/mcp/v1',
  WOOCOMMERCE: '/wp-json/mcp/v1',
};

export function normalizeMcpEndpoint(
  type: MCPConnectionType | 'WORDPRESS' | 'WOOCOMMERCE',
  endpoint: string
): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return trimmed;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const defaultPath = DEFAULT_MCP_PATH[type as MCPConnectionType];
  if (defaultPath) {
    const pathname = parsedUrl.pathname.replace(/\/+$/, '');
    const isRootPath = pathname === '' || pathname === '/';
    if (isRootPath) {
      parsedUrl.pathname = defaultPath;
    }
  }

  if (parsedUrl.pathname.length > 1) {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
  }

  parsedUrl.hash = '';
  return parsedUrl.toString();
}
