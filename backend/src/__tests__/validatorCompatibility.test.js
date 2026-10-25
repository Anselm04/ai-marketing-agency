import { jest } from '@jest/globals';
import {
  validateBody, validateQuery, validateParams, validateRequest,
  loginSchema, updateIntegrationsSchema, connectorConfigSchema,
} from '../utils/validator.js';

describe('request validation compatibility', () => {
  test.each([validateBody, validateQuery, validateParams])('invalid input returns structured validation errors', factory => {
    const req = { body: { email: 'invalid' }, query: { email: 'invalid' }, params: { email: 'invalid' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    factory(loginSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'email', message: expect.any(String) }),
    ]));
    expect(next).not.toHaveBeenCalled();
  });
  test('standalone validation retains the public error shape', () => {
    expect(validateRequest({}, loginSchema)).toEqual({
      success: false,
      errors: expect.arrayContaining([expect.objectContaining({ path: 'email', message: expect.any(String) })]),
    });
  });
  test('record schemas validate every integration and API key value', () => {
    expect(updateIntegrationsSchema.safeParse({ integrations: { google: true }, apiKeys: { google: 'key' } }).success).toBe(true);
    expect(updateIntegrationsSchema.safeParse({ integrations: { google: 'yes' } }).success).toBe(false);
    expect(updateIntegrationsSchema.safeParse({ apiKeys: { google: 42 } }).success).toBe(false);
    expect(connectorConfigSchema.safeParse({ connectorId: 'example', enabled: true, settings: { key: 'value', retries: 2 } }).success).toBe(true);
  });
});
