/**
 * Base MCP Adapter for HTTP-based MCP connections
 * Implements MCP 2024-11-05 protocol over HTTP
 */

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

export abstract class BaseMCPAdapter {
  protected endpoint: string;
  protected sessionId: string | null = null;
  protected requestId: number = 0;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Get authentication headers for the specific adapter
   */
  abstract getAuthHeaders(): Record<string, string>;

  /**
   * Send a JSON-RPC request to the MCP server
   */
  protected async sendRequest<T = unknown>(request: {
    method: string;
    params?: Record<string, unknown>;
  }): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.getAuthHeaders(),
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    this.requestId++;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method: request.method,
        params: request.params || {},
      }),
    });

    // Capture session ID from response
    const newSessionId = response.headers.get('mcp-session-id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'MCP error');
    }

    return data.result as T;
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<MCPServerInfo> {
    const result = await this.sendRequest<{
      protocolVersion: string;
      serverInfo: MCPServerInfo;
      capabilities: Record<string, unknown>;
    }>({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'BusinessTuner',
          version: '1.0.0',
        },
      },
    });

    // Send initialized notification
    await this.sendRequest({
      method: 'notifications/initialized',
      params: {},
    });

    return result.serverInfo;
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest<{ tools: MCPTool[] }>({
      method: 'tools/list',
      params: {},
    });
    return result.tools;
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    return this.sendRequest<MCPCallResult>({
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    });
  }

  /**
   * Close the MCP session
   */
  async close(): Promise<void> {
    if (this.sessionId) {
      try {
        await fetch(this.endpoint, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.sessionId,
            ...this.getAuthHeaders(),
          },
        });
      } catch {
        // Ignore errors on close
      }
      this.sessionId = null;
    }
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}
