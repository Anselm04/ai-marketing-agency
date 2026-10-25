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

const META_GRAPH_VERSION = 'v26.0';

function currentMetaConnector(connector) {
  if (!['meta_facebook', 'meta_instagram', 'meta_ads'].includes(connector.id)) return connector;

  return {
    ...connector,
    baseUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}`,
    healthCheck: connector.healthCheck
      ? {
          ...connector.healthCheck,
          url: String(connector.healthCheck.url || '')
            .replace(/graph\.facebook\.com\/v\d+(?:\.\d+)?/i, `graph.facebook.com/${META_GRAPH_VERSION}`),
        }
      : connector.healthCheck,
    auth: {
      ...(connector.auth || {}),
      authorizationUrl: connector.auth?.authorizationUrl
        ? String(connector.auth.authorizationUrl)
            .replace(/facebook\.com\/v\d+(?:\.\d+)?/i, `facebook.com/${META_GRAPH_VERSION}`)
        : connector.auth?.authorizationUrl,
      tokenUrl: connector.auth?.tokenUrl
        ? String(connector.auth.tokenUrl)
            .replace(/graph\.facebook\.com\/v\d+(?:\.\d+)?/i, `graph.facebook.com/${META_GRAPH_VERSION}`)
        : connector.auth?.tokenUrl,
      revokeUrl: connector.auth?.revokeUrl
        ? String(connector.auth.revokeUrl)
            .replace(/graph\.facebook\.com\/v\d+(?:\.\d+)?/i, `graph.facebook.com/${META_GRAPH_VERSION}`)
        : connector.auth?.revokeUrl,
    },
  };
}

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

  return currentMetaConnector(connector);
}

export const currentSocialConnectors = socialConnectors.map(currentMetaConnector);
export const currentAdsConnectors = adsConnectors.map(currentAdvertisingConnector);

export const allConnectors = [
  ...currentSocialConnectors,
  ...ecommerceConnectors,
  ...currentAdsConnectors,
  ...crmConnectors,
  ...messagingConnectors,
  ...contentConnectors,
];

export const connectorCategories = [
  { id: 'social', name: 'Social Media', icon: 'share-2', count: currentSocialConnectors.length },
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