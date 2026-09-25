import { generateAgentResponse } from './openaiService.js';

const DEFAULT_PLATFORMS = ['TikTok', 'Instagram', 'YouTube'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeJson(value) {
  if (!value || typeof value !== 'string') return null;
  const fenced = value.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
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
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const count = clamp(maxClips || 6, 1, 12);
  const duration = Number(sourceDurationSeconds) > 0 ? Number(sourceDurationSeconds) : count * 45;

  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((duration / count) * index);
    const end = Math.min(duration, start + 35);
    const seed = sentences[index % Math.max(sentences.length, 1)] || brief || 'High-value campaign moment';
    return {
      id: `clip-${index + 1}`,
      title: `Clip ${index + 1}: ${seed.slice(0, 52)}`,
      hook: seed.slice(0, 120),
      startSeconds: start,
      endSeconds: end,
      durationSeconds: Math.max(8, end - start),
      platforms,
      caption: seed.slice(0, 220),
      hashtags: ['#shorts', '#marketing', '#content'],
      qualityScore: 70 - index,
      status: 'planned',
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
    hashtags: Array.isArray(raw?.hashtags)
      ? raw.hashtags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 15)
      : [],
    qualityScore: clamp(Number(raw?.qualityScore) || 70, 0, 100),
    status: 'planned',
    mediaUrl: null,
    scheduledAt: null,
    publishResults: [],
  };
}

class ClippingAgencyService {
  validateRightsManifest(manifest = {}) {
    const errors = [];
    if (manifest.confirmedOwnership !== true) {
      errors.push('Content ownership or commercial-use permission must be confirmed.');
    }
    if (!Array.isArray(manifest.allowedPlatforms) || manifest.allowedPlatforms.length === 0) {
      errors.push('At least one allowed publishing platform is required.');
    }
    if (!manifest.commercialUseAllowed) {
      errors.push('Commercial use permission must be confirmed.');
    }
    if (manifest.expiresAt && Number.isNaN(new Date(manifest.expiresAt).getTime())) {
      errors.push('Rights expiry date is invalid.');
    }
    if (manifest.expiresAt && new Date(manifest.expiresAt) <= new Date()) {
      errors.push('Content rights have expired.');
    }
    return { valid: errors.length === 0, errors };
  }

  calculateEconomics(budget = 0, agencyRate = 0.2) {
    const totalBudget = Math.max(0, Number(budget) || 0);
    const normalizedRate = clamp(Number(agencyRate) || 0.2, 0.05, 0.5);
    const agencyRevenue = Number((totalBudget * normalizedRate).toFixed(2));
    return {
      totalBudget,
      agencyRate: normalizedRate,
      agencyRevenue,
      creatorPool: Number((totalBudget - agencyRevenue).toFixed(2)),
    };
  }

  async generateClipPlan(input = {}) {
    const platforms = normalizePlatforms(input.platforms);
    const maxClips = clamp(Number(input.maxClips) || 6, 1, 12);
    const contextText = String(input.transcript || input.brief || '').slice(0, 18000);

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

    const ai = await generateAgentResponse('video', prompt, {
      campaignName: input.name,
      targetAudience: input.targetAudience,
      brandVoice: input.brandVoice,
    });

    const parsed = safeJson(ai?.content);
    const rawClips = Array.isArray(parsed?.clips) ? parsed.clips.slice(0, maxClips) : null;
    const clips = rawClips?.length
      ? rawClips.map((clip, index) => normalizeClip(clip, index, platforms, input.sourceDurationSeconds))
      : fallbackClips({ ...input, platforms, maxClips });

    return {
      generatedAt: new Date().toISOString(),
      aiFallback: ai?.fallback === true || !rawClips?.length,
      platforms,
      clips,
    };
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

  async optimize(performance = [], campaign = {}) {
    const normalized = Array.isArray(performance) ? performance : [];
    const totals = normalized.reduce(
      (acc, row) => {
        acc.views += Number(row.views) || 0;
        acc.clicks += Number(row.clicks) || 0;
        acc.conversions += Number(row.conversions) || 0;
        acc.revenue += Number(row.revenue) || 0;
        return acc;
      },
      { views: 0, clicks: 0, conversions: 0, revenue: 0 },
    );

    const summary = {
      ...totals,
      ctr: totals.views ? Number(((totals.clicks / totals.views) * 100).toFixed(2)) : 0,
      conversionRate: totals.clicks
        ? Number(((totals.conversions / totals.clicks) * 100).toFixed(2))
        : 0,
      roas: Number(campaign.budget) > 0
        ? Number((totals.revenue / Number(campaign.budget)).toFixed(2))
        : 0,
    };

    const ai = await generateAgentResponse(
      'performance-optimizer',
      'Recommend the next 3 actions for this clipping campaign. Focus on retention, hook testing, platform allocation, posting cadence, and conversion efficiency.',
      { campaign: { name: campaign.name, platforms: campaign.platforms }, summary, performance: normalized.slice(-25) },
    );

    return {
      summary,
      recommendations: ai?.content || 'Continue testing hooks and publish the highest-retention variants first.',
      generatedAt: new Date().toISOString(),
    };
  }
}

export default new ClippingAgencyService();
