/**
 * WooCommerce MCP Adapter
 * Uses Consumer Key/Secret authentication
 */

import { BaseMCPAdapter } from './base.adapter';

export interface WooCommerceCredentials {
  consumerKey: string;
  consumerSecret: string;
}

export class WooCommerceAdapter extends BaseMCPAdapter {
  private credentials: WooCommerceCredentials;

  constructor(endpoint: string, credentials: WooCommerceCredentials) {
    super(endpoint);
    this.credentials = credentials;
  }

  getAuthHeaders(): Record<string, string> {
    // WooCommerce MCP typically uses a custom header or Basic Auth
    const auth = Buffer.from(
      `${this.credentials.consumerKey}:${this.credentials.consumerSecret}`
    ).toString('base64');

    return {
      'Authorization': `Basic ${auth}`,
    };
  }
}

/**
 * Common WooCommerce MCP tools
 */
export const WOOCOMMERCE_TOOLS = {
  // Products
  LIST_PRODUCTS: 'woo/list-products',
  GET_PRODUCT: 'woo/get-product',
  CREATE_PRODUCT: 'woo/create-product',
  UPDATE_PRODUCT: 'woo/update-product',
  DELETE_PRODUCT: 'woo/delete-product',

  // Orders
  LIST_ORDERS: 'woo/list-orders',
  GET_ORDER: 'woo/get-order',
  UPDATE_ORDER: 'woo/update-order',

  // Customers
  LIST_CUSTOMERS: 'woo/list-customers',
  GET_CUSTOMER: 'woo/get-customer',

  // Categories
  LIST_PRODUCT_CATEGORIES: 'woo/list-product-categories',

  // Coupons
  LIST_COUPONS: 'woo/list-coupons',
  CREATE_COUPON: 'woo/create-coupon',
} as const;
