/** Direct-response copy pack generator (ported from PR #23 themes; template-safe without keys). */

function clip(text, limit) {
  const t = String(text || '').trim();
  if (t.length <= limit) return t;
  return `${t.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

export function generateDirectResponsePack(brief = {}) {
  const product = String(brief.product || 'your offer').trim();
  const audience = String(brief.audience || 'your audience').trim();
  const description = String(brief.description || brief.business || '').trim();
  const offer = String(brief.offer || '').trim();
  const mechanism = String(brief.mechanism || '').trim();
  const proof = String(brief.proof || '').trim();

  const hero = `${product} for ${audience}`;
  const problem = description
    ? clip(description, 220)
    : `${audience} is still stitching tools together instead of shipping.`;
  const promise = offer || `Get a private marketing workspace that turns a brief into native posts — without fake ROAS.`;
  const how = mechanism || 'Brief in → platform-native copy, queue, and a short video out. Tokens stay per-account.';
  const evidence = proof || 'Honest limits: nothing goes live until a connector token exists.';

  return {
    product,
    audience,
    headlines: [
      hero,
      `Stop blasting one caption to 20 networks`,
      `A quieter flex for ${audience}`,
    ],
    leads: [
      problem,
      `If you are ${audience}, ${product} was shaped around your actual workflow.`,
    ],
    body: [promise, how, evidence].join('\n\n'),
    bullets: [
      'Per-network native posts (not identical spam)',
      'Hard spend caps on paid Meta/Google add-on',
      'OAuth stays honest when app credentials are missing',
    ],
    cta: `Start with ${product}`,
    ps: 'Organic social is included. Paid ads are opt-in and capped.',
    source: 'template',
  };
}

export default { generateDirectResponsePack };
