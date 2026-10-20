import { describe, expect, test } from '@jest/globals';
import { checkQuota, getPlanLimits } from '../services/planQuotaService.js';

describe('plan quota policy', () => {
  test('starter exposes only limits the backend can enforce', () => {
    expect(getPlanLimits('starter')).toEqual(expect.objectContaining({
      campaigns: 2,
      postsPerDay: 10,
      teamSeats: 1,
      monthlyAiTokens: 1_000_000,
    }));
  });

  test('higher plans have monotonically larger operating limits', () => {
    const starter = getPlanLimits('starter');
    const growth = getPlanLimits('growth');
    const agency = getPlanLimits('agency');
    const enterprise = getPlanLimits('enterprise');

    expect(growth.campaigns).toBeGreaterThan(starter.campaigns);
    expect(agency.monthlyAiTokens).toBeGreaterThan(growth.monthlyAiTokens);
    expect(enterprise.postsPerDay).toBeGreaterThan(agency.postsPerDay);
    expect(enterprise.teamSeats).toBeGreaterThan(agency.teamSeats);
  });

  test('quota checks reject an operation that would exceed its limit', () => {
    expect(checkQuota({ used: 9, requested: 1, limit: 10 }).allowed).toBe(true);
    expect(checkQuota({ used: 10, requested: 1, limit: 10 })).toEqual(expect.objectContaining({
      allowed: false,
      remaining: 0,
    }));
  });

  test('owner/unlimited access is never blocked by a numeric quota', () => {
    expect(checkQuota({ used: 999999, requested: 100, limit: Infinity }).allowed).toBe(true);
  });
});
