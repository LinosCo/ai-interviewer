/**
 * WordPress MCP Adapter
 * Uses Basic Auth with Application Password
 */

import { BaseMCPAdapter } from './base.adapter';

export interface WordPressCredentials {
  username: string;
  applicationPassword: string;
}

export class WordPressAdapter extends BaseMCPAdapter {
  private credentials: WordPressCredentials;

  constructor(endpoint: string, credentials: WordPressCredentials) {
    super(endpoint);
    this.credentials = credentials;
  }

  getAuthHeaders(): Record<string, string> {
    const auth = Buffer.from(
      `${this.credentials.username}:${this.credentials.applicationPassword}`
    ).toString('base64');

    return {
      'Authorization': `Basic ${auth}`,
    };
  }
}

/**
 * Common WordPress MCP tools
 */
export const WORDPRESS_TOOLS = {
  // Posts
  LIST_POSTS: 'mcp-wp/list-posts',
  GET_POST: 'mcp-wp/get-post',
  CREATE_POST: 'mcp-wp/create-post',
  UPDATE_POST: 'mcp-wp/update-post',
  DELETE_POST: 'mcp-wp/delete-post',

  // Pages
  LIST_PAGES: 'mcp-wp/list-pages',
  GET_PAGE: 'mcp-wp/get-page',
  CREATE_PAGE: 'mcp-wp/create-page',
  UPDATE_PAGE: 'mcp-wp/update-page',

  // Categories
  LIST_CATEGORIES: 'mcp-wp/list-categories',
  GET_CATEGORY: 'mcp-wp/get-category',

  // Media
  LIST_MEDIA: 'mcp-wp/list-media',
  UPLOAD_MEDIA: 'mcp-wp/upload-media',

  // Users
  GET_CURRENT_USER: 'mcp-wp/get-current-user',
} as const;
