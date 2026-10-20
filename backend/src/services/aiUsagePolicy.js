import { assertMonthlyAiTokenQuota } from './planQuotaService.js';
import { recordAiUsage } from './usageMeteringService.js';

export function estimateAiRequestTokens(messages = [], maxOutputTokens = 0) {
  const characters = (messages || []).reduce(
    (total, message) => total + String(message?.content || '').length,
    0,
  );
  return Math.max(1, Math.ceil(characters / 4) + Math.max(0, Number(maxOutputTokens) || 0));
}

export async function assertAiRequestAllowed(userId, messages = [], maxOutputTokens = 0) {
  if (!userId) return null;
  return assertMonthlyAiTokenQuota(
    userId,
    estimateAiRequestTokens(messages, maxOutputTokens),
  );
}

export async function accountAiResult({ userId, operation, result, provider, model }) {
  if (!userId || !result?.usage) return null;
  return recordAiUsage({
    userId,
    provider: result.provider || provider || null,
    model: result.model || model || null,
    operation,
    usage: result.usage,
  });
}
