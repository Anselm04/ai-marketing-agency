import express from 'express';
import store from '../utils/store.js';
import { userIdOf } from '../utils/scope.js';
import socialMediaService from '../services/socialMediaService.js';
import { generatePlatformCopy, MAJOR_SOCIALS, buildSchedule } from '../services/marketingEngine.js';
import { ORGANIC_PLATFORMS, ORGANIC_NETWORKS, ORGANIC_NETWORK_LABELS, canonicalPlatform, networkOf, CONTENT_TYPES, contentTypesOf } from '../services/spendGuard.js';
import { encryptUtf8, decryptUtf8 } from '../utils/owner.js';
import {
  PRIORITY_OAUTH_PLATFORMS,
  resolvePlatform,
  isOAuthConfigured,
  getClientCredentials,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  publicFrontendBase,
  socialOAuthCallbackUrl,
} from '../services/oauthPlatforms.js';
import { storeTokens } from '../services/appConnector.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

function publicConnection(row) {
  if (!row) return row;
  const { tokenCipher, token, accessToken, secret, ...safe } = row;
  return { ...safe, tokenSet: !!row.tokenSet, charge: 'included' };
}

function connectorConnected(platform) {
  const c = canonicalPlatform(platform);
  return !!socialMediaService.isAvailable(c) || !!socialMediaService.isAvailable(platform)
    || (c === 'x' && socialMediaService.isAvailable('twitter'));
}


function userTokenFor(conn) {
  if (!conn?.tokenCipher) return null;
  try { return decryptUtf8(conn.tokenCipher, 'social-token'); }
  catch { return null; }
}

function tokenKeyForPlatform(platform) {
  const m = resolvePlatform(platform);
  if (m?.tokenKey) return m.tokenKey;
  const c = canonicalPlatform(platform);
  if (c === 'x') return 'twitter';
  if (c === 'meta') return 'metaAds';
  if (c === 'google') return 'googleAds';
  return c;
}

async function publishWithPreferredToken(uid, platform, content) {
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === canonicalPlatform(platform));
  const userTok = userTokenFor(conn);
  const key = tokenKeyForPlatform(platform);
  const svc = userTok
    ? socialMediaService.withUserTokens({ [key]: userTok, ...(canonicalPlatform(platform) === 'x' ? { twitter: userTok, x: userTok } : {}) })
    : socialMediaService;
  return svc.publishToAll(content);
}

function honestResult(r) {
  const published = !!(r && r.success && !r.fallback && r.postId && r.postId !== 'placeholder');
  return {
    platform: r?.platform,
    published,
    queued: !published,
    success: published,
    fallback: !published,
    message: published
      ? 'Published via connected connector'
      : (r?.message || 'Not published. No connector token. Copy or queue this post instead.'),
  };
}



router.get('/oauth/status', async (req, res) => {
  const uid = userIdOf(req);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const byPlat = Object.fromEntries(mine.map((c) => [canonicalPlatform(c.platform), c]));
  const platforms = PRIORITY_OAUTH_PLATFORMS.map((m) => {
    const configured = isOAuthConfigured(m);
    const creds = getClientCredentials(m);
    const conn = byPlat[m.platform];
    const connected = !!(conn?.tokenSet && conn?.status === 'ready');
    return {
      platform: m.platform,
      label: m.label,
      kind: m.kind,
      connectorId: m.connectorId,
      oauthConfigured: configured,
      connected,
      setup: !!conn,
      tokenSet: !!conn?.tokenSet,
      envKeys: configured ? undefined : creds.envKeys,
      setupHint: configured
        ? null
        : `Set Fly secrets: ${creds.envKeys.join(', ')}. Until then Connect stays setup-only (no fake connected).`,
    };
  });
  res.json({
    success: true,
    apiBase: process.env.API_URL || process.env.PUBLIC_URL || 'https://trillionai-marketing.fly.dev',
    frontendBase: publicFrontendBase(),
    platforms,
  });
});

router.get('/oauth/:platform/start', async (req, res) => {
  const uid = userIdOf(req);
  const mapping = resolvePlatform(req.params.platform);
  if (!mapping) {
    return res.status(404).json({ error: 'Unknown OAuth platform', platform: req.params.platform });
  }
  if (!isOAuthConfigured(mapping)) {
    const creds = getClientCredentials(mapping);
    return res.status(400).json({
      error: `OAuth app credentials missing for ${mapping.label}`,
      needsConfig: true,
      envKeys: creds.envKeys,
      oauthConfigured: false,
      platform: mapping.platform,
      connectorId: mapping.connectorId,
    });
  }
  try {
    const built = buildAuthorizationUrl(mapping, { userId: uid });
    res.json({
      success: true,
      authorizationUrl: built.authorizationUrl,
      platform: mapping.platform,
      connectorId: mapping.connectorId,
      scopes: built.scopes,
      redirectUri: built.redirectUri,
      oauthConfigured: true,
    });
  } catch (err) {
    if (err.needsConfig || err.code === 'NEEDS_CONFIG') {
      return res.status(400).json({
        error: err.message,
        needsConfig: true,
        envKeys: err.envKeys || getClientCredentials(mapping).envKeys,
        oauthConfigured: false,
      });
    }
    logger.error('OAuth start failed', { error: err.message, platform: mapping.platform });
    res.status(500).json({ error: 'Could not start OAuth', detail: err.message });
  }
});

/** Provider redirect — no Bearer required (exempted in index.js). */
router.get('/oauth/:platform/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  const mapping = resolvePlatform(req.params.platform);
  const frontend = publicFrontendBase();
  if (error) {
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent(String(errorDescription || error))}`);
  }
  if (!mapping || !code || !state) {
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent('invalid_callback')}`);
  }
  try {
    const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString());
    const userId = parsed.userId;
    if (!userId) throw new Error('Missing userId in state');
    if (parsed.platform && parsed.platform !== mapping.platform) {
      throw new Error('Platform mismatch in OAuth state');
    }
    const tokens = await exchangeAuthorizationCode(mapping, {
      code: String(code),
      state: String(state),
      redirectUri: socialOAuthCallbackUrl(mapping.platform),
    });
    await storeTokens(userId, mapping.connectorId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
    let tokenCipher = null;
    try { tokenCipher = encryptUtf8(String(tokens.accessToken), 'social-token'); } catch { /* JWT_SECRET required */ }
    store.upsertSocialConnection(userId, mapping.platform, {
      tokenSet: true,
      status: 'ready',
      tokenCipher: tokenCipher || undefined,
      connectorId: mapping.connectorId,
      label: mapping.label,
      note: 'Connected via OAuth. Token stored encrypted; value not returned.',
    });
    logger.info('Social OAuth connected', { userId, platform: mapping.platform, connectorId: mapping.connectorId });
    return res.redirect(`${frontend}/social?connected=${encodeURIComponent(mapping.platform)}`);
  } catch (err) {
    logger.error('Social OAuth callback failed', { error: err.message, platform: mapping?.platform });
    return res.redirect(`${frontend}/social?oauth_error=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
});

router.get('/networks', (req, res) => {
  res.json({
    included: true,
    charge: 'included',
    paidAdsSeparate: true,
    labels: ORGANIC_NETWORK_LABELS,
    platforms: ORGANIC_NETWORKS.map((n) => ({
      ...n,
      contentTypes: CONTENT_TYPES[n.id] || [],
    })),
  });
});

router.get('/status', async (req, res) => {
  const uid = userIdOf(req);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const byPlat = Object.fromEntries(mine.map((c) => [canonicalPlatform(c.platform), c]));
  const status = await socialMediaService.getAllPlatformStatus();
  const seen = new Set();
  const merged = [];
  for (const p of status) {
    const id = canonicalPlatform(p.platform);
    if (seen.has(id)) continue;
    seen.add(id);
    const net = networkOf(id);
    merged.push({
      platform: id,
      name: net?.name || p.name,
      category: net?.category || p.category || 'Social',
      connected: !!p.connected,
    });
  }
  for (const net of ORGANIC_NETWORKS) {
    if (seen.has(net.id)) continue;
    seen.add(net.id);
    merged.push({ platform: net.id, name: net.name, category: net.category, connected: false });
  }
  res.json(merged.map((p) => {
    const c = byPlat[p.platform];
    const token = !!p.connected || !!c?.tokenSet;
    return {
      ...p,
      connected: token,
      organic: ORGANIC_PLATFORMS.includes(p.platform),
      setup: !!c,
      tokenSet: token,
      charge: ORGANIC_PLATFORMS.includes(p.platform) ? 'included' : (p.category === 'Ads' ? 'paid-addon' : 'optional'),
    };
  }));
});

router.get('/connections', async (req, res) => {
  const list = await store.getSocialConnectionsByOwner(userIdOf(req));
  res.json({
    included: true,
    platforms: ORGANIC_PLATFORMS,
    networks: ORGANIC_NETWORKS.map((n) => ({ id: n.id, name: n.name, category: n.category })),
    connections: list.map(publicConnection),
  });
});

router.post('/connect', async (req, res) => {
  const uid = userIdOf(req);
  const platform = canonicalPlatform(req.body?.platform);
  if (!platform) return res.status(400).json({ error: 'platform required' });
  const rawToken = req.body?.token || req.body?.accessToken;
  const hasToken = !!rawToken;
  const extra = {
    status: hasToken ? 'ready' : 'needs_token',
    tokenSet: hasToken,
    label: req.body?.label || networkOf(platform)?.name || platform,
    note: hasToken
      ? 'Token stored as present (value not returned).'
      : 'Bring your own token later. You can still generate, copy, and queue native posts.',
  };
  if (hasToken) {
    try { extra.tokenCipher = encryptUtf8(String(rawToken), 'social-token'); }
    catch { extra.tokenSet = true; extra.note = 'Token marked present. Value not returned.'; }
  }
  const row = store.upsertSocialConnection(uid, platform, extra);
  res.status(201).json({ ...publicConnection(row), charge: 'included', published: false });
});

router.delete('/connect/:platform', async (req, res) => {
  const uid = userIdOf(req);
  const plat = canonicalPlatform(req.params.platform);
  const list = await store.getSocialConnectionsByOwner(uid);
  const row = list.find((c) => canonicalPlatform(c.platform) === plat);
  if (!row) return res.status(404).json({ error: 'Not connected' });
  await store.deleteSocialConnection(row.id, uid);
  res.json({ success: true });
});

router.get('/posts', async (req, res) => {
  const posts = (await store.getSocialPostsByOwner(userIdOf(req)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

router.post('/generate', async (req, res) => {
  const uid = userIdOf(req);
  const product = String(req.body?.product || req.body?.productName || '').trim();
  const audience = String(req.body?.audience || req.body?.targetAudience || '').trim();
  const description = String(req.body?.description || req.body?.business || req.body?.brief || '').trim();
  if (!product && !description) {
    return res.status(400).json({ error: 'Describe the product and audience first.' });
  }
  const wanted = Array.isArray(req.body?.platforms) && req.body.platforms.length
    ? req.body.platforms.map(canonicalPlatform).map((id) => networkOf(id) || MAJOR_SOCIALS.find((p) => p.id === id)).filter(Boolean)
    : MAJOR_SOCIALS;
  const contentType = String(req.body?.contentType || req.body?.type || '').trim();
  const copy = await generatePlatformCopy({
    product: product || 'Your product',
    audience: audience || 'your audience',
    description,
    ownerId: uid,
    tone: req.body?.tone || 'professional',
    platforms: wanted,
  });
  const schedule = buildSchedule(wanted);
  const posts = [];
  const bodies = [];
  for (const spec of wanted) {
    const c = copy[spec.id];
    if (!c) continue;
    bodies.push(c.body);
    posts.push(await store.createSocialPost({
      owner: uid,
      platform: spec.id,
      platformName: spec.name,
      body: c.body,
      hashtags: c.hashtags,
      contentType: contentType || 'native_post',
      status: 'draft',
      published: false,
      scheduledAt: schedule.find((s) => s.platform === spec.id)?.scheduledAt || null,
    }));
  }
  const uniqueBodies = new Set(bodies).size;
  res.status(201).json({
    success: true,
    published: false,
    posts,
    uniqueBodies,
    platforms: wanted.length,
    disclaimer: 'Drafts in your workspace. Platform-specific — not an identical blast. Not posted until a connector token exists.',
  });
});

router.post('/queue', async (req, res) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.body?.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const updated = await store.updateSocialPost(post.id, {
    status: 'queued',
    published: false,
    scheduledAt: req.body?.scheduledAt || post.scheduledAt || new Date(Date.now() + 3600000).toISOString(),
  }, uid);
  res.json({ ...updated, published: false, message: 'Queued in your workspace. Not sent to the network.' });
});

router.post('/posts/:id/publish', async (req, res) => {
  const uid = userIdOf(req);
  const post = await store.getSocialPostById(req.params.id, uid);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const platform = canonicalPlatform(post.platform);
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === platform);
  const connected = connectorConnected(platform) || !!conn?.tokenSet;
  if (!connected) {
    const queued = await store.updateSocialPost(post.id, { status: 'queued', published: false }, uid);
    return res.json({
      ...honestResult({ platform, fallback: true, message: `Queued. ${post.platformName || platform} has no token yet. Copy the native post or connect later.` }),
      post: queued,
    });
  }
  const raw = await publishWithPreferredToken(uid, platform, {
    [platform]: true,
    twitter: platform === 'x',
    caption: post.body,
    text: post.body,
    message: post.body,
    hashtags: post.hashtags || [],
  });
  const honest = honestResult(raw[0] || { platform, fallback: true });
  const updated = await store.updateSocialPost(post.id, {
    status: honest.published ? 'published' : 'queued',
    published: honest.published,
  }, uid);
  res.json({ ...honest, post: updated });
});

router.post('/publish', async (req, res) => {
  const uid = userIdOf(req);
  const caption = req.body?.caption || req.body?.text || req.body?.message || '';
  const platforms = Object.keys(req.body || {}).filter((k) => req.body[k] === true && !['caption', 'text', 'message', 'hashtags', 'videoUrl', 'imageUrl'].includes(k)).map(canonicalPlatform);
  if (platforms.length > 1 && caption) {
    return res.status(400).json({
      error: 'No identical spam blasts. Generate platform-specific posts, then publish each one. POST /api/social/generate then POST /api/social/posts/:id/publish.',
    });
  }
  const results = [];
  if (platforms.length === 0) {
    const raw = await socialMediaService.publishToAll(req.body || {});
    return res.json({ success: true, published: false, results: (raw || []).map(honestResult) });
  }
  const platform = platforms[0];
  const mine = await store.getSocialConnectionsByOwner(uid);
  const conn = mine.find((c) => canonicalPlatform(c.platform) === platform);
  const connected = connectorConnected(platform) || !!conn?.tokenSet;
  const post = await store.createSocialPost({
    owner: uid,
    platform,
    body: caption,
    hashtags: req.body.hashtags || [],
    status: connected ? 'publishing' : 'queued',
    published: false,
  });
  if (!connected) {
    results.push({
      platform,
      postId: post.id,
      published: false,
      queued: true,
      message: `Queued. ${platform} is not connected. Copy the text into the app or connect a token later.`,
    });
    return res.json({ success: true, published: false, results });
  }
  const raw = await publishWithPreferredToken(uid, platform, { [platform]: true, twitter: platform === 'x', caption, text: caption, message: caption, ...req.body });
  const honest = honestResult(raw[0] || { platform, fallback: true });
  await store.updateSocialPost(post.id, { status: honest.published ? 'published' : 'queued', published: honest.published }, uid);
  results.push({ ...honest, postId: post.id });
  res.json({ success: true, published: results.some((r) => r.published), results });
});

router.post('/:platform', async (req, res) => {
  const platform = canonicalPlatform(req.params.platform);
  if (['generate', 'queue', 'posts', 'status', 'publish', 'connect', 'connections', 'oauth', 'networks'].includes(platform)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!connectorConnected(platform)) {
    const post = await store.createSocialPost({
      owner: userIdOf(req),
      platform,
      body: req.body?.caption || req.body?.text || '',
      status: 'queued',
      published: false,
    });
    return res.json({ platform, published: false, queued: true, postId: post.id, message: 'Not published — connector not connected.' });
  }
  const raw = await socialMediaService.publishToAll({ [platform]: true, twitter: platform === 'x', ...req.body });
  res.json(honestResult(raw[0] || { platform, fallback: true }));
});

export default router;
