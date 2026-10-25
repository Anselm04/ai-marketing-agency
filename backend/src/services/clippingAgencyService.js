import { generateAgentResponse } from './openaiService.js';
import userVideoPublisherService from './userVideoPublisherService.js';

const DEFAULT_PLATFORMS = ['TikTok', 'Instagram', 'YouTube'];
const MIN_VERIFIED_OBSERVATIONS = 3;
const MIN_VERIFIED_VIEWS = 100;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeJson(value) {
  if (!value || typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : value;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizePlatforms(platforms) {
  const values = Array.isArray(platforms) ? platforms : [];
  const unique = [...new Set(values.map((p) => String(p).trim()).filter(Boolean))];
  return unique.length ? unique : DEFAULT_PLATFORMS;
}

function fallbackClips({ transcript, brief, platforms, maxClips, sourceDurationSeconds }) {
  const text = String(transcript || brief || '').trim();
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const count = clamp(maxClips || 6, 1, 12);
  const duration = Number(sourceDurationSeconds) > 0 ? Number(sourceDurationSeconds) : count * 45;

  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((duration / count) * index);
    const end = Math.min(duration, start + 35);
    const seed = sentences[index % Math.max(sentences.length, 1)] || brief || 'Source-backed campaign moment';
    return {
      id: `clip-${index + 1}`,
      title: `Clip ${index + 1}: ${seed.slice(0, 52)}`,
      hook: seed.slice(0, 120),
      startSeconds: start,
      endSeconds: end,
      durationSeconds: Math.max(8, end - start),
      platforms,
      caption: seed.slice(0, 220),
      hashtags: [],
      qualityScore: null,
      status: 'development_fallback_only',
      mediaUrl: null,
      scheduledAt: null,
      publishResults: [],
    };
  });
}

function normalizeClip(raw, index, platforms, sourceDurationSeconds) {
  const start = Math.max(0, Number(raw?.startSeconds) || 0);
  const proposedEnd = Number(raw?.endSeconds) || start + Number(raw?.durationSeconds) || start + 30;
  const sourceEnd = Number(sourceDurationSeconds) > 0 ? Number(sourceDurationSeconds) : proposedEnd;
  const end = Math.max(start + 8, Math.min(proposedEnd, sourceEnd));

  return {
    id: raw?.id || `clip-${index + 1}`,
    title: String(raw?.title || `Clip ${index + 1}`).slice(0, 120),
    hook: String(raw?.hook || '').slice(0, 220),
    startSeconds: Math.round(start),
    endSeconds: Math.round(end),
    durationSeconds: Math.max(8, Math.round(end - start)),
    platforms: normalizePlatforms(raw?.platforms?.length ? raw.platforms : platforms),
    caption: String(raw?.caption || raw?.hook || '').slice(0, 2200),
    hashtags: Array.isArray(raw?.hashtags) ? raw.hashtags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 15) : [],
    qualityScore: clamp(Number(raw?.qualityScore) || 70, 0, 100),
    status: 'planned',
    mediaUrl: null,
    scheduledAt: null,
    publishResults: [],
  };
}

function verifiedPerformanceRows(performance = []) {
  return (Array.isArray(performance) ? performance : []).filter((row) => (
    row?.provenance?.kind === 'provider_verified'
    && row?.provenance?.provider
    && row?.provenance?.observedAt
  ));
}

function clippingError(message, code = 'clipping_ai_generation_failed') {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 503;
  return error;
}

class ClippingAgencyService {
  validateRightsManifest(manifest = {}) {
    const errors = [];
    if (manifest.confirmedOwnership !== true) errors.push('Content ownership or commercial-use permission must be confirmed.');
    if (!Array.isArray(manifest.allowedPlatforms) || manifest.allowedPlatforms.length === 0) errors.push('At least one allowed publishing platform is required.');
    if (!manifest.commercialUseAllowed) errors.push('Commercial use permission must be confirmed.');
    if (manifest.expiresAt && Number.isNaN(new Date(manifest.expiresAt).getTime())) errors.push('Rights expiry date is invalid.');
    if (manifest.expiresAt && new Date(manifest.expiresAt) <= new Date()) errors.push('Content rights have expired.');
    return { valid: errors.length === 0, errors };
  }

  calculateEconomics(budget = 0, agencyRate = 0.2) {
    const totalBudget = Math.max(0, Number(budget) || 0);
    const normalizedRate = clamp(Number(agencyRate) || 0.2, 0.05, 0.5);
    const agencyRevenue = Number((totalBudget * normalizedRate).toFixed(2));
    return { totalBudget, agencyRate: normalizedRate, agencyRevenue, creatorPool: Number((totalBudget - agencyRevenue).toFixed(2)) };
  }

  async generateClipPlan(input = {}) {
    const platforms = normalizePlatforms(input.platforms);
    const maxClips = clamp(Number(input.maxClips) || 6, 1, 12);
    const contextText = String(input.transcript || input.brief || '').trim().slice(0, 18000);
    if (!contextText) {
      throw clippingError('Clip planning requires a transcript or creator-provided source notes. Generic clip plans are not substituted.', 'clipping_source_evidence_required');
    }

    const prompt = [
      'Design a short-form clipping campaign from the supplied source material.',
      'Return JSON only with a top-level "clips" array.',
      'Each clip must include: title, hook, startSeconds, endSeconds, caption, hashtags, qualityScore, platforms.',
      'Prioritize strong opening hooks, standalone meaning, retention, factual fidelity, and platform-safe phrasing.',
      'Do not invent quotes that are not supported by the source material.',
      `Create at most ${maxClips} clips.`,
      `Target platforms: ${platforms.join(', ')}.`,
      `Source duration seconds: ${Number(input.sourceDurationSeconds) || 'unknown'}.`,
      `Campaign brief: ${String(input.brief || '').slice(0, 2000)}`,
      `Transcript/source notes: ${contextText}`,
    ].join('\n');

    let ai;
    try {
      ai = await generateAgentResponse('video', prompt, {
        userId: input.owner || input.ownerId,
        campaignName: input.name,
        targetAudience: input.targetAudience,
        brandVoice: input.brandVoice,
      });
    } catch (error) {
      throw clippingError(`Clip planning failed: ${error.message || 'AI provider error'}`);
    }
    if (ai?.fallback === true) {
      throw clippingError('Clip planning is unavailable because the configured AI provider did not complete the request. No generic clip plan was substituted.');
    }

    const parsed = safeJson(ai?.content);
    const rawClips = Array.isArray(parsed?.clips) ? parsed.clips.slice(0, maxClips) : null;
    if (!rawClips?.length) {
      throw clippingError('The AI provider returned an invalid or empty clip plan. No generic clip plan was substituted.');
    }

    const clips = rawClips.map((clip, index) => normalizeClip(clip, index, platforms, input.sourceDurationSeconds));
    return { generatedAt: new Date().toISOString(), aiFallback: false, platforms, clips };
  }

  scheduleClips(clips = [], options = {}) {
    const startAt = options.startAt ? new Date(options.startAt) : new Date();
    const intervalMinutes = clamp(Number(options.intervalMinutes) || 180, 30, 1440);
    return clips.map((clip, index) => ({
      ...clip,
      scheduledAt: new Date(startAt.getTime() + index * intervalMinutes * 60_000).toISOString(),
      status: clip.mediaUrl ? 'ready' : 'awaiting_media',
    }));
  }

  async publishClip(userId, clip = {}, publishingSettings = {}) {
    const results = [];
    const platforms = normalizePlatforms(clip.platforms);
    for (const platform of platforms) {
      results.push(await userVideoPublisherService.publish({
        userId,
        platformId: platform,
        mediaUrl: clip.mediaUrl,
        title: clip.title,
        caption: clip.caption,
        hashtags: clip.hashtags,
        settings: publishingSettings[String(platform).toLowerCase()] || {},
      }));
    }
    return results;
  }

  async optimize(performance = [], campaign = {}) {
    const verified = verifiedPerformanceRows(performance);
    const totals = verified.reduce(
      (acc, row) => {
        acc.views += Number(row.views) || 0;
        acc.clicks += Number(row.clicks) || 0;
        acc.conversions += Number(row.conversions) || 0;
        acc.revenue += Number(row.revenue) || 0;
        return acc;
      },
      { views: 0, clicks: 0, conversions: 0, revenue: 0 },
    );

    if (verified.length < MIN_VERIFIED_OBSERVATIONS || totals.views < MIN_VERIFIED_VIEWS) {
      return {
        status: 'insufficient_verified_data',
        generatedAt: new Date().toISOString(),
        verifiedObservations: verified.length,
        verifiedViews: totals.views,
        minimumVerifiedObservations: MIN_VERIFIED_OBSERVATIONS,
        minimumVerifiedViews: MIN_VERIFIED_VIEWS,
        summary: null,
        recommendations: null,
        reason: 'Optimization requires provider-verified performance evidence and a minimum sample size.',
      };
    }

    const summary = {
      ...totals,
      ctr: Number(((totals.clicks / totals.views) * 100).toFixed(2)),
      conversionRate: totals.clicks ? Number(((totals.conversions / totals.clicks) * 100).toFixed(2)) : 0,
      roas: Number(campaign.budget) > 0 ? Number((totals.revenue / Number(campaign.budget)).toFixed(2)) : null,
      evidence: { kind: 'provider_verified', observations: verified.length },
    };

    const ai = await generateAgentResponse(
      'performance-optimizer',
      'Recommend the next 3 actions for this clipping campaign. Focus on retention, hook testing, platform allocation, posting cadence, and conversion efficiency. Use only the verified evidence supplied.',
      { userId: campaign.owner || campaign.ownerId, campaign: { name: campaign.name, platforms: campaign.platforms }, summary, performance: verified.slice(-25) },
    );

    if (ai?.fallback === true || !String(ai?.content || '').trim()) {
      return {
        status: 'verified_evidence_ai_unavailable',
        summary,
        recommendations: null,
        generatedAt: new Date().toISOString(),
        reason: 'Verified analytics are available, but the AI optimizer did not return a real recommendation.',
      };
    }

    return { status: 'verified_evidence', summary, recommendations: ai.content, generatedAt: new Date().toISOString() };
  }
}

export { fallbackClips, MIN_VERIFIED_OBSERVATIONS, MIN_VERIFIED_VIEWS, verifiedPerformanceRows };
export default new ClippingAgencyService();
