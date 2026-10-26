import { reserveMonthlyAiTokenQuota } from './planQuotaService.js';
import { estimateConfiguredAiCost, recordAiUsage } from './usageMeteringService.js';
import { releaseQuotaReservation, settleUsageReservation } from './quotaReservationService.js';
import {
  releaseMonthlyAiCostQuota,
  reserveMonthlyAiCostQuota,
  settleMonthlyAiCostQuota,
} from './aiMonetaryCapService.js';

export function estimateAiRequestTokens(messages = [], maxOutputTokens = 0) {
  const characters = (messages || []).reduce(
    (total, message) => total + String(message?.content || '').length,
    0,
  );
  return Math.max(1, Math.ceil(characters / 4) + Math.max(0, Number(maxOutputTokens) || 0));
}

export async function reserveAiRequest(userId, messages = [], maxOutputTokens = 0, context = {}) {
  if (!userId) return null;

  const tokenContext = await reserveMonthlyAiTokenQuota(
    userId,
    estimateAiRequestTokens(messages, maxOutputTokens),
  );

  let monetary = null;
  try {
    monetary = await reserveMonthlyAiCostQuota({
      userId,
      messages,
      maxOutputTokens,
      provider: context.provider || context.providerId || null,
    });
  } catch (error) {
    await releaseQuotaReservation(tokenContext?.reservation?.id).catch(() => {});
    throw error;
  }

  return { ...tokenContext, monetary };
}

function actualTokens(usage = {}) {
  const explicit = Number(usage.total_tokens ?? usage.totalTokens);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const input = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const output = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  return Math.max(0, input) + Math.max(0, output);
}

export async function settleAiRequest({ reservation, userId, operation, result, provider, model }) {
  const tokenReservationId = reservation?.reservation?.id;
  const monetary = reservation?.monetary || null;

  if (!userId || !result?.usage) {
    await Promise.all([
      releaseQuotaReservation(tokenReservationId),
      releaseMonthlyAiCostQuota(monetary),
    ]);
    return null;
  }

  const resolvedProvider = result.provider || provider || null;
  const resolvedModel = result.model || model || null;
  const actualCostUsd = estimateConfiguredAiCost(resolvedProvider, result.usage);

  try {
    let usageResult = null;
    if (!tokenReservationId) {
      usageResult = await recordAiUsage({
        userId,
        provider: resolvedProvider,
        model: resolvedModel,
        operation,
        usage: result.usage,
      });
    } else {
      usageResult = await settleUsageReservation({
        id: tokenReservationId,
        userId,
        metric: 'ai_tokens',
        quantity: actualTokens(result.usage),
        provider: resolvedProvider,
        model: resolvedModel,
        costUsd: actualCostUsd,
        metadata: {
          operation,
          promptTokens: Number(result.usage.prompt_tokens ?? result.usage.input_tokens ?? 0),
          completionTokens: Number(result.usage.completion_tokens ?? result.usage.output_tokens ?? 0),
        },
      });
    }

    const monetaryResult = await settleMonthlyAiCostQuota({
      monetary,
      userId,
      provider: resolvedProvider,
      model: resolvedModel,
      operation,
      actualCostUsd,
    });
    return { usage: usageResult, monetary: monetaryResult };
  } catch (error) {
    await Promise.all([
      releaseQuotaReservation(tokenReservationId).catch(() => {}),
      releaseMonthlyAiCostQuota(monetary).catch(() => {}),
    ]);
    throw error;
  }
}

export async function cancelAiRequest(reservation) {
  await Promise.all([
    releaseQuotaReservation(reservation?.reservation?.id),
    releaseMonthlyAiCostQuota(reservation?.monetary),
  ]);
}

// Backward-compatible names for routes that use the policy directly.
export const assertAiRequestAllowed = reserveAiRequest;
export async function accountAiResult(args) {
  return settleAiRequest({ ...args, reservation: args.reservation || null });
}
