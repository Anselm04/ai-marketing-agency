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

export const allConnectors = [
  ...socialConnectors,
  ...ecommerceConnectors,
  ...adsConnectors,
  ...crmConnectors,
  ...messagingConnectors,
  ...contentConnectors,
];

export const connectorCategories = [
  { id: 'social', name: 'Social Media', icon: 'share-2', count: socialConnectors.length },
  { id: 'ecommerce', name: 'E-Commerce', icon: 'shopping-cart', count: ecommerceConnectors.length },
  { id: 'ads', name: 'Advertising', icon: 'megaphone', count: adsConnectors.length },
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
