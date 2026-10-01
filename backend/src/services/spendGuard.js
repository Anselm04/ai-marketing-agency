/** Hard spend caps for paid ads. Organic social is uncapped (plan-included). */

export const DEFAULT_BUDGET = { dailyMax: 10, monthlyMax: 100, currency: 'USD' };

/** 20 organic networks included in every plan. Paid Meta/Google are a separate add-on. */
export const ORGANIC_NETWORKS = [
  { id: 'youtube', name: 'YouTube', limit: 180, voice: 'title + description energy, search-friendly', category: 'Video' },
  { id: 'tiktok', name: 'TikTok', limit: 150, voice: 'native, hook in the first line, trend-aware', category: 'Social' },
  { id: 'instagram', name: 'Instagram', limit: 2000, voice: 'visual, warm, caption-first with a clear CTA', category: 'Social' },
  { id: 'facebook', name: 'Facebook', limit: 480, voice: 'friendly, story-led, community', category: 'Social' },
  { id: 'linkedin', name: 'LinkedIn', limit: 680, voice: 'professional, insight-led, no hype', category: 'Social' },
  { id: 'x', name: 'X', limit: 270, voice: 'punchy, conversational, no fluff', category: 'Social' },
  { id: 'reddit', name: 'Reddit', limit: 900, voice: 'value-first, no marketing-speak, community native', category: 'Social' },
  { id: 'pinterest', name: 'Pinterest', limit: 400, voice: 'searchable, descriptive, idea-board', category: 'Social' },
  { id: 'threads', name: 'Threads', limit: 480, voice: 'casual conversation, short paragraphs', category: 'Social' },
  { id: 'snapchat', name: 'Snapchat', limit: 120, voice: 'ephemeral, casual, friend-to-friend', category: 'Social' },
  { id: 'github', name: 'GitHub', limit: 500, voice: 'technical README tone, ship logs, no hype', category: 'Professional' },
  { id: 'producthunt', name: 'Product Hunt', limit: 260, voice: 'maker launch, first-comment energy', category: 'Professional' },
  { id: 'indiehackers', name: 'Indie Hackers', limit: 900, voice: 'maker diary, honest build log, no hype ROAS', category: 'Professional' },
  { id: 'hackernews', name: 'Hacker News', limit: 80, voice: 'Show HN factual, curious, no marketing-speak', category: 'Professional' },
  { id: 'dev', name: 'DEV', limit: 800, voice: 'developer tutorial opener, useful, no spam', category: 'Content' },
  { id: 'hashnode', name: 'Hashnode', limit: 800, voice: 'dev blog opener, practical, community-first', category: 'Content' },
  { id: 'replit', name: 'Replit', limit: 400, voice: 'ship-in-browser, remixable, builder energy', category: 'Professional' },
  { id: 'discord', name: 'Discord', limit: 400, voice: 'community, helpful, no spam blasts', category: 'Messaging' },
  { id: 'telegram', name: 'Telegram', limit: 400, voice: 'channel update, concise, link-first', category: 'Messaging' },
  { id: 'whatsapp', name: 'WhatsApp', limit: 300, voice: 'personal, permission-based, one-to-one', category: 'Messaging' },
];

export const ORGANIC_PLATFORMS = ORGANIC_NETWORKS.map((n) => n.id);
export const ORGANIC_NETWORK_LABELS = ORGANIC_NETWORKS.map((n) => n.name).join(', ');
export const PAID_NETWORKS = ['meta', 'google'];

const ALIASES = {
  twitter: 'x', 'twitter/x': 'x', 'x.com': 'x', yt: 'youtube',
  'product-hunt': 'producthunt', product_hunt: 'producthunt', gh: 'github',
  'google-ads': 'google', 'meta-ads': 'meta', fb: 'facebook', ig: 'instagram',
  'indie-hackers': 'indiehackers', indie_hackers: 'indiehackers', ih: 'indiehackers',
  'hacker-news': 'hackernews', hacker_news: 'hackernews', hn: 'hackernews',
  devto: 'dev', 'dev.to': 'dev', 'dev-to': 'dev', repl: 'replit',
};

export function canonicalPlatform(id) {
  const n = String(id || '').toLowerCase().trim();
  return ALIASES[n] || n;
}

export function networkOf(id) {
  const c = canonicalPlatform(id);
  return ORGANIC_NETWORKS.find((n) => n.id === c) || null;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function budgetOf(user) {
  const b = user?.adBudget || {};
  return {
    dailyMax: clamp(num(b.dailyMax, DEFAULT_BUDGET.dailyMax), 0, 100000),
    monthlyMax: clamp(num(b.monthlyMax, DEFAULT_BUDGET.monthlyMax), 0, 1000000),
    currency: 'USD',
  };
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function sumSpend(entries, since) {
  const t = since.getTime();
  return (entries || [])
    .filter((e) => e && new Date(e.at).getTime() >= t)
    .reduce((s, e) => s + num(e.amount, 0), 0);
}

export function remaining(user, entries) {
  const b = budgetOf(user);
  const now = new Date();
  const daySpent = sumSpend(entries, startOfUtcDay(now));
  const monthSpent = sumSpend(entries, startOfUtcMonth(now));
  const remainingToday = Math.max(0, +(b.dailyMax - daySpent).toFixed(2));
  const remainingMonth = Math.max(0, +(b.monthlyMax - monthSpent).toFixed(2));
  return {
    ...b,
    daySpent: +daySpent.toFixed(2),
    monthSpent: +monthSpent.toFixed(2),
    remainingToday,
    remainingMonth,
    remaining: Math.min(remainingToday, remainingMonth),
    paidAdsAddon: !!user?.paidAdsAddon,
    organicIncluded: true,
    organicNetworks: ORGANIC_PLATFORMS.length,
  };
}

export function assertLaunchAllowed(user, entries, amount) {
  const r = remaining(user, entries);
  if (!r.paidAdsAddon) {
    return { ok: false, status: 402, error: 'Paid ads add-on required. Organic posting on your connected socials is included in your plan. Meta/Google ads are extra.' };
  }
  const amt = num(amount, 0);
  if (amt <= 0) return { ok: false, status: 400, error: 'Spend amount must be greater than 0.' };
  if (amt > r.remaining) {
    return { ok: false, status: 400, error: `Blocked: this would exceed your spend cap. Remaining $${r.remaining} (daily $${r.remainingToday} / monthly $${r.remainingMonth}).` };
  }
  return { ok: true, remaining: r, amount: amt };
}

export function contentTypesOf(platform) {
  return [{ id: 'native_post', name: 'Native post', hint: 'Platform-specific, not a blast' }];
}

export default {
  DEFAULT_BUDGET, budgetOf, remaining, assertLaunchAllowed,
  ORGANIC_PLATFORMS, ORGANIC_NETWORKS, ORGANIC_NETWORK_LABELS, PAID_NETWORKS,
  canonicalPlatform, networkOf, contentTypesOf,
};
