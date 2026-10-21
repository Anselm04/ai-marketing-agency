import { describe, expect, test, jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.js';

function responseDouble() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('error handler', () => {
  test('returns safe plan quota metadata to the client', () => {
    const res = responseDouble();
    errorHandler(Object.assign(new Error('Campaign limit reached'), {
      status: 402,
      code: 'plan_quota_exceeded',
      resource: 'campaigns',
      plan: 'starter',
      quota: { used: 2, requested: 1, limit: 2, remaining: 0 },
    }), {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Campaign limit reached',
      code: 'plan_quota_exceeded',
      resource: 'campaigns',
      plan: 'starter',
      quota: { used: 2, requested: 1, limit: 2, remaining: 0 },
    }));
  });

  test('does not leak internal error details for 500 responses', () => {
    const res = responseDouble();
    errorHandler(Object.assign(new Error('database secret detail'), { status: 500, code: 'db_failure' }), {}, res, () => {});
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal server error' }));
    expect(res.json.mock.calls[0][0].code).toBeUndefined();
  });
});
