import { describe, test, expect, jest } from '@jest/globals';
import { aiModelRegistry } from '../services/aiModelRegistry.js';
import { allConnectors, getConnectorById, getConnectorsByCategory } from '../services/connectors/index.js';
import { validateRequest } from '../utils/validator.js';
import { z } from 'zod';

describe('Production Utilities', () => {
  test('AI Model Registry has providers', () => {
    const providers = aiModelRegistry.getAllProviders();
    expect(providers.length).toBeGreaterThan(0);
  });

  test('AI Model Registry has models', () => {
    const models = aiModelRegistry.getAllModels();
    expect(models.length).toBeGreaterThan(0);
  });

  test('Can get model info', () => {
    const info = aiModelRegistry.getModelInfo('gpt-4o');
    expect(info).toBeDefined();
    expect(info.name).toBe('GPT-4o');
  });

  test('All connectors loaded', () => {
    expect(allConnectors.length).toBeGreaterThan(0);
  });

  test('Can find connector by ID', () => {
    const connector = getConnectorById('shopify');
    expect(connector).toBeDefined();
    expect(connector.name).toBe('Shopify');
  });

  test('Can filter connectors by category', () => {
    const social = getConnectorsByCategory('social');
    expect(social.length).toBeGreaterThan(0);
  });

  test('Zod validation works', () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = validateRequest({ name: 'Test' }, schema);
    expect(result.success).toBe(true);
  });

  test('Zod validation catches invalid data', () => {
    const schema = z.object({ email: z.string().email() });
    const result = validateRequest({ email: 'not-an-email' }, schema);
    expect(result.success).toBe(false);
  });
});
