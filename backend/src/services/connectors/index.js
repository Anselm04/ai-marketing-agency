/**
 * Connector Registry Index
 * Aggregates all 100+ connector definitions across categories.
 */

import { socialConnectors } from './social.js';
import { ecommerceConnectors } from './ecommerce.js';
import { adsConnectors } from './ads.js';
import { crmConnectors } from './crm.js';
import { messagingConnectors } from './messaging.js';
import { contentConnectors } from './content.js';

function currentAdvertisingConnector(connector) {
  if (connector.id === 'google_ads') {
    return {
      ...connector,
      baseUrl: 'https://googleads.googleapis.com/v26',
      healthCheck: {
        ...(connector.healthCheck || {}),
        url: 'https://googleads.googleapis.com/v26/customers:listAccessibleCustomers',
      },
      auth: {
        ...(connector.auth || {}),
        // Google sunset developer tokens in September 2026. OAuth/API access is
        // managed by the Google Cloud project and its approved Ads API access level.
        developerToken: undefined,
      },
    };
  }

  if (connector.id === 'meta_ads') {
    return {
      ...connector,
      baseUrl: 'https://graph.facebook.com/v26.0',
      healthCheck: {
        ...(connector.healthCheck || {}),
        url: 'https://graph.facebook.com/v26.0/me',
      },
      auth: {
        ...(connector.auth || {}),
        authorizationUrl: 'https://www.facebook.com/v26.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v26.0/oauth/access_token',
        revokeUrl: 'https://graph.facebook.com/v26.0/me/permissions',
      },
    };
  }

  return connector;
}

export const currentAdsConnectors = adsConnectors.map(currentAdvertisingConnector);

export const allConnectors = [
  ...socialConnectors,
  ...ecommerceConnectors,
  ...currentAdsConnectors,
  ...crmConnectors,
  ...messagingConnectors,
  ...contentConnectors,
];

export const connectorCategories = [
  { id: 'social', name: 'Social Media', icon: 'share-2', count: socialConnectors.length },
  { id: 'ecommerce', name: 'E-Commerce', icon: 'shopping-cart', count: ecommerceConnectors.length },
  { id: 'ads', name: 'Advertising', icon: 'megaphone', count: currentAdsConnectors.length },
  { id: 'crm', name: 'CRM & Analytics', icon: 'bar-chart-3', count: crmConnectors.length },
  { id: 'messaging', name: 'Messaging & Comms', icon: 'message-circle', count: messagingConnectors.length },
  { id: 'content', name: 'Content & Reviews', icon: 'pen-tool', count: contentConnectors.length },
];

export function getConnectorById(id) {
  return allConnectors.find((c) => c.id === id) || null;
}

export function getConnectorsByCategory(category) {
  return allConnectors.filter((c) => c.category === category);
}

export function getConnectorCategories() {
  return connectorCategories;
}

export function getAllConnectors() {
  return allConnectors.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    icon: c.icon,
    description: c.description,
    authType: c.auth?.type || 'none',
  }));
}

export default {
  allConnectors,
  connectorCategories,
  getConnectorById,
  getConnectorsByCategory,
  getConnectorCategories,
  getAllConnectors,
};
