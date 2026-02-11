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

    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text();

    if (!response.ok) {
      let errorMessage = `${response.status} ${response.statusText}`;
      if (rawBody.trim()) {
        try {
          const parsed: unknown = JSON.parse(rawBody);
          if (parsed && typeof parsed === 'object') {
            const parsedObj = parsed as {
              error?: { message?: string } | string;
              message?: string;
            };
            const maybeMessage =
              typeof parsedObj.error === 'string'
                ? parsedObj.error
                : parsedObj.error?.message || parsedObj.message;
            if (typeof maybeMessage === 'string') {
              errorMessage = maybeMessage;
            } else {
              errorMessage = rawBody.slice(0, 200);
            }
          } else {
            errorMessage = rawBody.slice(0, 200);
          }
        } catch {
          errorMessage = rawBody.slice(0, 200);
        }
      }
      throw new Error(`MCP request failed (${response.status}): ${errorMessage}`);
    }

    if (!rawBody.trim()) {
      if (request.method.startsWith('notifications/')) {
        return {} as T;
      }
      throw new Error('MCP response body is empty');
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawBody);
    } catch {
      const bodyPreview = rawBody.replace(/\s+/g, ' ').trim().slice(0, 140);
      const looksLikeHtml = /^<!doctype html>|^<html/i.test(rawBody.trim());
      if (looksLikeHtml) {
        throw new Error(
          'L\'endpoint MCP ha risposto con HTML invece di JSON. Verifica di usare l\'URL endpoint MCP completo (non solo la root del sito).'
        );
      }
      const typeLabel = contentType || 'content-type sconosciuto';
      throw new Error(
        `Risposta MCP non valida (${typeLabel}): ${bodyPreview || 'body vuoto'}`
      );
    }

    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error('MCP response payload is not an object');
    }

    const data = parsedData as {
      error?: { message?: string } | string;
      result?: T;
    };

    if (data.error) {
      const errorMessage = typeof data.error === 'string' ? data.error : data.error.message;
      throw new Error(errorMessage || 'MCP error');
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
