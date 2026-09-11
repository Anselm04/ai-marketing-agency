import crypto from 'crypto';
import { generateAgentResponse, generateCampaignStrategy } from './openaiService.js';
import { ORGANIC_NETWORKS } from './spendGuard.js';

export const MAJOR_SOCIALS = ORGANIC_NETWORKS;

function hashSeed(parts) {
  return crypto.createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

function pick(seedHex, index, options) {
  const n = parseInt(seedHex.slice(index * 2, index * 2 + 4), 16);
  return options[n % options.length];
}

function clip(text, limit) {
  const t = String(text || '').trim();
  if (t.length <= limit) return t;
  return `${t.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function hashtags(product, audience, platform, seed) {
  const base = String(product || 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18) || 'brand';
  const aud = String(audience || 'audience')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 14) || 'audience';
  const extras = {
    x: ['buildinpublic', 'growth'],
    instagram: ['reels', 'brandstory'],
    tiktok: ['fyp', 'learnontiktok'],
    facebook: ['smallbusiness', 'community'],
    linkedin: ['b2b', 'leadership'],
    youtube: ['howto', 'subscribe'],
    reddit: ['discussion', 'ama'],
    pinterest: ['ideas', 'moodboard'],
    threads: ['conversation', 'now'],
    snapchat: ['snap', 'story'],
    github: ['opensource', 'shipping'],
    producthunt: ['producthunt', 'launch'],
    discord: ['community', 'server'],
    telegram: ['channel', 'update'],
    whatsapp: ['broadcast', 'hello'],
    indiehackers: ['indiehacker', 'buildinpublic'],
    hackernews: ['showhn', 'askhn'],
    dev: ['devtools', 'codenewbie'],
    hashnode: ['webdev', 'blog'],
    replit: ['replit', 'remix'],
  };
  const extra = extras[platform] || ['marketing', 'launch'];
  const flavor = pick(seed, 3, ['launch', 'now', 'new', 'live']);
  return [`#${base}`, `#${aud}`, `#${extra[0]}`, `#${extra[1] || flavor}`, `#trillionai`].slice(0, 5);
}

function uniqueTemplateCopy({ product, audience, description, platform, seed, ownerId }) {
  const p = product || 'your product';
  const a = audience || 'your audience';
  const d = (description || '').replace(/\s+/g, ' ').trim();
  const detail = d ? clip(d, 140) : `built for ${a}`;
  const hook = pick(seed, 0, [
    `${p} is for ${a} who are done waiting.`,
    `If you are ${a}, ${p} was made around your actual workflow.`,
    `${a}: stop stitching five tools together. ${p} is the loop.`,
    `A quieter flex for ${a}: ${p} that actually ships work.`,
  ]);
  const proof = pick(seed, 1, [
    `Brief in. Campaign, posts, and a short video out — private to you.`,
    `Per-platform copy, a queue, and a downloadable video from your own brief.`,
    `Not a shared demo. Your product, your audience, your artifacts.`,
  ]);
  const cta = pick(seed, 2, [
    `Try ${p} today.`,
    `Save this and start with ${p}.`,
    `Tell ${p} who you serve — get the first week of posts.`,
    `Open ${p} and generate your first campaign.`,
  ]);
  const tags = hashtags(p, a, platform.id, seed).join(' ');
  const id = platform.id;
  const bodyByPlatform = {
    youtube: `Title: ${p} for ${a}\n\n${clip(detail, 80)}\n\nChapters-style description. No fake views. ${cta}\n${tags}`,
    tiktok: `Hook: ${hook}\nOn-screen: ${clip(detail, 40)}\n${cta} ${tags}`,
    instagram: `${hook}\n\n${detail}\n\n${proof}\n\nSave this if you are ${a}.\n\n${cta}\n\n${tags}`,
    facebook: `For the ${a} group:\n\n${hook}\n\n${detail}\n\n${proof}\n\nComment \"guide\" and we will not auto-blast your wall.\n\n${cta}`,
    linkedin: `${p} for ${a} — a note, not a pitch.\n\n${detail}\n\n${proof}\n\nWhat I will not do: invent ROAS or post the same line on 20 networks.\n\n${cta}`,
    x: `${hook} ${clip(detail, 70)}\n\n${cta} ${tags}`,
    reddit: `r/relevant: I built ${p} because ${a} kept hitting the same wall.\n\n${detail}\n\nNot selling in the title. Honest limitation: posts stay in your workspace until a token exists.\n\n${proof}`,
    pinterest: `${p} idea pin for ${a}\n\n${clip(detail, 90)}\n\nAlt text: ${p} workflow for ${a}. ${cta}`,
    threads: `${hook}\n\n${clip(detail, 120)}\n\nReply with the job you actually need done.\n${cta}`,
    snapchat: `${p} for ${a}. ${clip(detail, 50)} ${cta}`,
    github: `## ${p}\n\nAudience: ${a}\n\n${detail}\n\nShip log, not a growth hack. Issues and README stay yours. ${cta}`,
    producthunt: `${p} — ${clip(detail, 90)}\n\nMade for ${a}. First comment: what it does not do (no fake worldwide ads).\n${cta}`,
    discord: `**${p}** drop for ${a}\n${detail}\n\nUse the channel, do not spam DMs. ${cta}`,
    telegram: `${p} update for ${a}\n${clip(detail, 120)}\n\n${cta}`,
    whatsapp: `Hi — ${p} is for ${a}. ${clip(detail, 80)} Only sending this if you opted in. ${cta}`,
    indiehackers: `Shipped: ${p} for ${a}\n\n${detail}\n\nHonest limit: this is a workspace draft, not a fake revenue screenshot.\n${cta}`,
    hackernews: `Show HN: ${p} — ${clip(detail, 60)}\n\nBuilt for ${a}. What it does not do: auto-blast 20 networks or invent ROAS.`,
    dev: `# ${p} for ${a}\n\n${hook}\n\n${detail}\n\nA tutorial-shaped opener, not a dump of the same caption.\n\n${cta}`,
    hashnode: `${p} for ${a}\n\n${hook}\n\n${detail}\n\n${proof}\n\nPractical first. ${cta}`,
    replit: `Remix ${p}\nAudience: ${a}\n${clip(detail, 90)}\nHow to run: fork, set the brief, generate native posts. ${cta}`,
  };
  const raw = bodyByPlatform[id] || `${hook}\n\n${detail}\n\n${cta} ${tags}`;
  return {
    platform: id,
    platformName: platform.name,
    body: clip(raw, platform.limit || 400),
    hashtags: hashtags(p, a, id, seed),
    cta,
    source: 'template',
    ownerHint: ownerId ? ownerId.slice(0, 8) : null,
  };
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
      { name: 'Listen & brief', duration: 'Day 0', tactics: ['Capture product + audience in your private workspace', 'Generate 20-network copy from that brief only'] },
      { name: 'Publish-ready artifacts', duration: 'Days 1-3', tactics: ['Queue native posts per platform (no identical blast)', 'Render a short captioned video you can download'] },
      { name: 'SEO + follow-up', duration: 'Days 4-7', tactics: ['Ship a landing blurb and keyword set from your brief', 'Reuse winning lines; do not claim live posting without a connector token'] },
    ],
    budgetAllocation: { organic: 100, paidAds: 0 },
    kpis: ['posts queued (not fake-published)', 'video downloads', 'copy saved per platform', 'replies from your own audience'],
    contentIdeas: [
      `Hook: why ${a} still cobble this together without ${p}`,
      `Demo clip: ${p} turning a brief into 20 platform posts`,
      `Founder note: what ${p} will not do (no fake worldwide publish, no fake ROAS)`,
      `SEO page: \"${p} for ${a}\" with the real differentiator`,
      `Proof: a downloaded video file generated from this brief (${seed.slice(0, 8)})`,
    ],
    risks: [
      { risk: 'Posting without tokens', mitigation: 'Queue and copy until a connector exists' },
      { risk: 'Generic copy', mitigation: 'Every line is seeded from this user brief, never another customer' },
      { risk: 'Identical spam blasts', mitigation: 'Each network gets its own body, length, and voice' },
    ],
    fallback: true,
    uniqueKey: seed.slice(0, 16),
  };
}

function resolvePlatform(platform) {
  if (platform && typeof platform === 'object' && platform.id) return platform;
  const id = String(platform || '').toLowerCase();
  return MAJOR_SOCIALS.find((p) => p.id === id || p.name.toLowerCase() === id) || { id, name: id, limit: 400, voice: 'clear and specific' };
}

export async function generatePlatformCopy({ product, audience, description, ownerId, platforms = MAJOR_SOCIALS, tone = 'professional' }) {
  const results = {};
  await Promise.all(platforms.map(async (platform) => {
    const spec = resolvePlatform(platform);
    const seed = hashSeed([ownerId, product, audience, description, spec.id]);
    const prompt = `Write ONE ${spec.name} post for product \"${product}\" targeting \"${audience}\".\nBrand voice: ${tone}. Platform voice: ${spec.voice}.\nProduct brief (do not mention other customers): ${clip(description || '', 500)}\nHard limit ${spec.limit} characters. Include a CTA and 3-5 hashtags.\nDo not copy the same wording you would use on another network. Return only the post text.`;
    try {
      const ai = await generateAgentResponse('social-media', prompt, { product, audience, platform: spec.id, ownerId });
      if (ai?.fallback || !ai?.content) {
        results[spec.id] = uniqueTemplateCopy({ product, audience, description, platform: spec, seed, ownerId });
        return;
      }
      results[spec.id] = {
        platform: spec.id,
        platformName: spec.name,
        body: clip(ai.content, spec.limit),
        hashtags: hashtags(product, audience, spec.id, seed),
        source: 'openai',
      };
    } catch {
      results[spec.id] = uniqueTemplateCopy({ product, audience, description, platform: spec, seed, ownerId });
    }
  }));
  return results;
}

export async function generateSeoPackage({ product, audience, description, ownerId }) {
  const seed = hashSeed([ownerId, product, audience, 'seo']);
  const slug = String(product || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'product';
  const primary = `${product || 'product'} for ${audience || 'teams'}`.toLowerCase();
  const fallback = {
    primaryKeyword: primary,
    secondaryKeywords: [
      `${product} marketing`,
      `${audience} campaign`,
      `ai social posts`,
      `short video ads`,
      `${slug} launch`,
    ],
    metaTitle: clip(`${product || 'Product'} for ${audience || 'your market'} | TrillionAI Marketing`, 60),
    metaDescription: clip(`Private ${product || 'product'} campaigns for ${audience || 'your audience'}. Generate platform copy, queue posts, and download a short video. ${clip(description || '', 80)}`, 155),
    slug,
    blogTopics: [
      `How ${audience || 'buyers'} evaluate ${product || 'this product'}`,
      `A 7-day content plan for ${product || 'your launch'}`,
      `What “published” should mean when connectors are not connected`,
    ],
    uniqueKey: seed.slice(0, 12),
    source: 'template',
  };
  try {
    const ai = await generateAgentResponse('seo-aeo', `SEO package for \"${product}\" / audience \"${audience}\". Brief: ${clip(description || '', 400)}. Return primary keyword, 6 secondary keywords, meta title <60, meta description <160, slug, 3 blog topics.`, { ownerId });
    if (ai?.fallback || !ai?.content) return fallback;
    return { ...fallback, body: ai.content, source: 'openai' };
  } catch {
    return fallback;
  }
}

export async function generateCampaignBundle({ product, audience, description, ownerId, tone = 'professional', platforms = MAJOR_SOCIALS }) {
  const copy = await generatePlatformCopy({ product, audience, description, ownerId, platforms, tone });
  let strategy;
  try {
    strategy = await generateCampaignStrategy(product || 'Product', 1000, platforms.map((p) => p.name || p), audience || 'general');
  } catch {
    strategy = { fallback: true };
  }
  const plan = strategy?.fallback || !strategy?.strategy
    ? templateCampaignPlan({ product, audience, description, ownerId })
    : strategy.strategy;
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
