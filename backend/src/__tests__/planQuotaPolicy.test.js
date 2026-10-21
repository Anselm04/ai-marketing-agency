import { describe, expect, test } from '@jest/globals';
import { checkQuota, getAccessibleAgents, getPlanLimits } from '../services/planQuotaService.js';

describe('plan quota policy', () => {
  test('starter exposes only limits the backend can enforce', () => {
    expect(getPlanLimits('starter')).toEqual(expect.objectContaining({
      agents: 3,
      campaigns: 2,
      postsPerDay: 10,
      monthlyAiTokens: 1_000_000,
    }));
    expect(getPlanLimits('starter')).not.toHaveProperty('teamSeats');
  });

  test('higher plans have monotonically larger operating limits', () => {
    const starter = getPlanLimits('starter');
    const growth = getPlanLimits('growth');
    const agency = getPlanLimits('agency');
    const enterprise = getPlanLimits('enterprise');

    expect(growth.agents).toBeGreaterThan(starter.agents);
    expect(growth.campaigns).toBeGreaterThan(starter.campaigns);
    expect(agency.monthlyAiTokens).toBeGreaterThan(growth.monthlyAiTokens);
    expect(enterprise.postsPerDay).toBeGreaterThan(agency.postsPerDay);
  });

  test('agent access is limited to the number advertised by the plan', () => {
    const agents = Array.from({ length: 12 }, (_, index) => ({ agentId: `agent-${index + 1}` }));
    expect(getAccessibleAgents(agents, getPlanLimits('starter'))).toHaveLength(3);
    expect(getAccessibleAgents(agents, getPlanLimits('growth'))).toHaveLength(8);
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
