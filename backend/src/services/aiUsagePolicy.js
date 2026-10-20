import { reserveMonthlyAiTokenQuota } from './planQuotaService.js';
import { estimateConfiguredAiCost, recordAiUsage } from './usageMeteringService.js';
import { releaseQuotaReservation, settleUsageReservation } from './quotaReservationService.js';

export function estimateAiRequestTokens(messages = [], maxOutputTokens = 0) {
  const characters = (messages || []).reduce(
    (total, message) => total + String(message?.content || '').length,
    0,
  );
  return Math.max(1, Math.ceil(characters / 4) + Math.max(0, Number(maxOutputTokens) || 0));
}

export async function reserveAiRequest(userId, messages = [], maxOutputTokens = 0) {
  if (!userId) return null;
  return reserveMonthlyAiTokenQuota(
    userId,
    estimateAiRequestTokens(messages, maxOutputTokens),
  );
}

function actualTokens(usage = {}) {
  const explicit = Number(usage.total_tokens ?? usage.totalTokens);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return Math.max(0, input) + Math.max(0, output);
}

export async function settleAiRequest({ reservation, userId, operation, result, provider, model }) {
  if (!userId || !result?.usage) {
    await releaseQuotaReservation(reservation?.reservation?.id);
    return null;
  }
  const resolvedProvider = result.provider || provider || null;
  const resolvedModel = result.model || model || null;
  const reservationId = reservation?.reservation?.id || null;
  if (!reservationId) {
    return recordAiUsage({
      userId,
      provider: resolvedProvider,
      model: resolvedModel,
      operation,
      usage: result.usage,
    });
  }
  return settleUsageReservation({
    id: reservationId,
    userId,
    metric: 'ai_tokens',
    quantity: actualTokens(result.usage),
    provider: resolvedProvider,
    model: resolvedModel,
    costUsd: estimateConfiguredAiCost(resolvedProvider, result.usage),
    metadata: {
      operation,
      promptTokens: Number(result.usage.prompt_tokens ?? result.usage.input_tokens ?? 0),
      completionTokens: Number(result.usage.completion_tokens ?? result.usage.output_tokens ?? 0),
    },
  });
}

export async function cancelAiRequest(reservation) {
  await releaseQuotaReservation(reservation?.reservation?.id);
}

// Backward-compatible names for routes that use the policy directly.
export const assertAiRequestAllowed = reserveAiRequest;
export async function accountAiResult(args) {
  return settleAiRequest({ ...args, reservation: args.reservation || null });
}
