/**
 * Brevo MCP Adapter
 * Uses Brevo API key authentication.
 */

import { BaseMCPAdapter } from './base.adapter';

export interface BrevoCredentials {
  apiKey: string;
  partnerKey?: string;
}

export class BrevoAdapter extends BaseMCPAdapter {
  private credentials: BrevoCredentials;

  constructor(endpoint: string, credentials: BrevoCredentials) {
    super(endpoint);
    this.credentials = credentials;
  }

  getAuthHeaders(): Record<string, string> {
    const apiKey = this.credentials.apiKey.trim();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'api-key': apiKey,
    };

    if (this.credentials.partnerKey?.trim()) {
      headers['partner-key'] = this.credentials.partnerKey.trim();
    }

    return headers;
  }
}

/**
 * Common Brevo MCP tools (naming can vary by server implementation)
 */
export const BREVO_TOOLS = {
  SEND_TRANSACTIONAL_EMAIL: 'brevo/send-transactional-email',
  CREATE_CONTACT: 'brevo/create-contact',
  UPDATE_CONTACT: 'brevo/update-contact',
  LIST_CONTACTS: 'brevo/list-contacts',
  CREATE_CAMPAIGN: 'brevo/create-campaign',
  GET_CAMPAIGN: 'brevo/get-campaign',
} as const;
