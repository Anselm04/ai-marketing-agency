import crypto from 'crypto';
import { ORGANIC_NETWORKS } from './spendGuard.js';

export const MAJOR_SOCIALS = ORGANIC_NETWORKS;

function hashSeed(parts) {
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

function clip(text, limit) {
  const t = String(text || '').trim();
  if (t.length <= limit) return t;
  return `${t.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function buildSchedule(platforms, start = new Date()) {
  const slots = [];
  platforms.forEach((p, pi) => {
    for (let day = 0; day < 7; day += 2) {
      const when = new Date(start.getTime() + (day + 1) * 24 * 60 * 60 * 1000);
      when.setUTCHours(9 + ((pi + day) % 8), (pi * 7) % 60, 0, 0);
      slots.push({
        platform: p.id || p,
        platformName: p.name || p,
        scheduledAt: when.toISOString(),
        status: 'queued',
      });
    }
  });
  return slots.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
}

export function templateCampaignPlan({ product, audience, description, ownerId }) {
  const seed = hashSeed([ownerId, product, audience, description, 'plan']);
  const p = product || 'Your product';
  const a = audience || 'your audience';
  return {
    campaignName: `${p} — 7-day launch for ${a}`,
    phases: [
      { name: 'Listen & brief', duration: 'Day 0', tactics: ['Capture product + audience', 'Generate native copy'] },
      { name: 'Publish-ready artifacts', duration: 'Days 1-3', tactics: ['Queue native posts', 'Render short video'] },
      { name: 'SEO + follow-up', duration: 'Days 4-7', tactics: ['Landing blurb', 'Reuse winning lines'] },
    ],
    budgetAllocation: { organic: 100, paidAds: 0 },
    kpis: ['posts queued', 'video downloads', 'copy saved'],
    contentIdeas: [`Hook for ${a}`, `Demo of ${p}`, `Honest limits`],
    risks: [{ risk: 'Posting without tokens', mitigation: 'Queue until connected' }],
    fallback: true,
    uniqueKey: seed.slice(0, 16),
  };
}

export async function generatePlatformCopy({ product, audience, description, ownerId, platforms = MAJOR_SOCIALS }) {
  const results = {};
  for (const platform of platforms) {
    const id = platform.id || platform;
    const name = platform.name || id;
    const limit = platform.limit || 400;
    const seed = hashSeed([ownerId, product, audience, description, id]);
    const body = clip(
      `${product || 'Product'} for ${audience || 'your audience'}. ${clip(description || '', 120)} Native to ${name} — not a blast. Try ${product || 'it'} today. #${String(product || 'brand').replace(/\W/g, '').slice(0, 12)}`,
      limit,
    );
    results[id] = { platform: id, platformName: name, body, hashtags: [], source: 'template', ownerHint: ownerId ? String(ownerId).slice(0, 8) : null };
  }
  return results;
}

export async function generateSeoPackage({ product, audience, description, ownerId }) {
  const seed = hashSeed([ownerId, product, audience, 'seo']);
  const slug = String(product || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  return {
    primaryKeyword: `${product || 'product'} for ${audience || 'teams'}`.toLowerCase(),
    secondaryKeywords: [`${product} marketing`, `${audience} campaign`],
    metaTitle: clip(`${product || 'Product'} for ${audience || 'your market'} | TrillionAI Marketing`, 60),
    metaDescription: clip(`Private ${product || 'product'} campaigns for ${audience || 'your audience'}. ${clip(description || '', 80)}`, 155),
    slug,
    blogTopics: [`How ${audience || 'buyers'} evaluate ${product || 'this product'}`],
    uniqueKey: seed.slice(0, 12),
    source: 'template',
  };
}

export async function generateCampaignBundle({ product, audience, description, ownerId, tone = 'professional', platforms = MAJOR_SOCIALS }) {
  const copy = await generatePlatformCopy({ product, audience, description, ownerId, platforms, tone });
  const plan = templateCampaignPlan({ product, audience, description, ownerId });
  const seo = await generateSeoPackage({ product, audience, description, ownerId });
  const schedule = buildSchedule(platforms);
  return { copy, plan, seo, schedule, platforms: platforms.map((p) => p.id || p) };
}

export function videoScriptFromBrief({ product, audience, description, ownerId }) {
  const seed = hashSeed([ownerId, product, audience, 'video']);
  const p = product || 'Your product';
  const a = audience || 'your audience';
  const d = clip(description || `A private marketing workspace for ${a}.`, 90);
  return {
    durationSec: 8,
    uniqueKey: seed.slice(0, 10),
    scenes: [
      { t: 0, caption: p, sub: `for ${a}` },
      { t: 2, caption: clip(d, 42), sub: 'Your brief. Your copy.' },
      { t: 4, caption: '20 networks. Native posts.', sub: 'YT · TikTok · IG · FB · LI · X' },
      { t: 6, caption: 'Download this video.', sub: 'Not published until you connect' },
    ],
  };
}

export default {
  MAJOR_SOCIALS,
  generatePlatformCopy,
  generateCampaignBundle,
  generateSeoPackage,
  templateCampaignPlan,
  buildSchedule,
  videoScriptFromBrief,
};
