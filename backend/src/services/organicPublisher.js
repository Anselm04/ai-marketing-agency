/**
 * Organic publish for accounts connected through /api/social/oauth.
 * Uses the encrypted connector token (refresh + page/member ids), not env bearer tokens.
 */
import axios from 'axios';
import { getTokens, storeTokens } from './appConnector.js';
import {
  resolvePlatform,
  getClientCredentials,
  getConnectorForPlatform,
  metaGraphVersion,
} from './oauthPlatforms.js';
import '../services/withUserTokensPatch.js';
import { publishInstagram, publishYouTube, publishTikTok } from './organicMedia.js';

export function expiryMs(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

export function apiError(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || 'request failed';
  if (typeof data === 'string') return data.slice(0, 500);
  const nested = data.error?.message || data.error_description || data.detail || data.title || data.message;
  if (nested && nested !== 'ok') return String(nested).slice(0, 500);
  try { return JSON.stringify(data).slice(0, 500); } catch { return err.message; }
}

export function composeText(content = {}) {
  const tags = (Array.isArray(content.hashtags) ? content.hashtags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  const body = content.caption || content.text || content.message || content.body || '';
  return [String(body).trim(), tags.join(' ')].filter(Boolean).join('\n').trim();
}

export function linkedInPostBody({ personUrn, text }) {
  return {
    author: personUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

export function blocked(platform, error) {
  return { success: false, platform, blocked: true, published: false, error };
}

async function refreshAccessToken(mapping, refreshToken) {
  const connector = getConnectorForPlatform(mapping);
  const creds = getClientCredentials(mapping);
  if (!connector?.auth?.tokenUrl || !creds.clientId || !creds.clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (mapping.connectorId === 'twitter_x') {
    headers.Authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64')}`;
    body.set('client_id', creds.clientId);
  } else if (mapping.connectorId === 'tiktok') {
    body.set('client_key', creds.clientId);
    body.set('client_secret', creds.clientSecret);
  } else {
    body.set('client_id', creds.clientId);
    body.set('client_secret', creds.clientSecret);
  }
  const res = await axios.post(connector.auth.tokenUrl, body, { headers, timeout: 20000 });
  const data = res.data?.access_token ? res.data : (res.data?.data || {});
  if (!data.access_token) return null;
  return data;
}

async function loadAccess(userId, mapping, pastedToken) {
  const stored = await getTokens(userId, mapping.connectorId);
  if (!stored?.accessToken && !pastedToken) return { accessToken: null, metadata: {}, stored: null };
  let accessToken = stored?.accessToken || pastedToken;
  let metadata = { ...(stored?.metadata || {}) };
  const exp = expiryMs(stored?.expiresAt);
  const needsRefresh = stored?.refreshToken && exp && Date.now() > exp - 60_000;
  if (needsRefresh) {
    try {
      const refreshed = await refreshAccessToken(mapping, stored.refreshToken);
      if (refreshed?.access_token) {
        accessToken = refreshed.access_token;
        const expiresAt = refreshed.expires_in ? Date.now() + Number(refreshed.expires_in) * 1000 : stored.expiresAt;
        await storeTokens(userId, mapping.connectorId, {
          accessToken,
          refreshToken: refreshed.refresh_token || stored.refreshToken,
          expiresAt,
          scopes: stored.scopes,
          metadata,
        });
      }
    } catch {
      /* try the current access token; the platform will return a real error if it is dead */
    }
  }
  return { accessToken, metadata, stored };
}

async function listFacebookPages(userToken) {
  const res = await axios.get(`https://graph.facebook.com/${metaGraphVersion()}/me/accounts`, {
    params: {
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: userToken,
    },
    timeout: 20000,
  });
  return res.data?.data || [];
}

export async function resolvePage(accessToken, metadata, { instagram = false } = {}) {
  if (!instagram && metadata.pageId && metadata.pageAccessToken) {
    return { id: metadata.pageId, access_token: metadata.pageAccessToken, name: metadata.pageName };
  }
  if (instagram && metadata.igUserId && metadata.pageAccessToken) {
    return {
      id: metadata.pageId,
      access_token: metadata.pageAccessToken,
      instagram_business_account: { id: metadata.igUserId, username: metadata.igUsername },
    };
  }
  const pages = await listFacebookPages(accessToken);
  const wanted = process.env.FACEBOOK_PAGE_ID;
  const page = (wanted && pages.find((item) => String(item.id) === String(wanted)))
    || (instagram ? pages.find((item) => item.instagram_business_account) : null)
    || pages[0];
  return page || null;
}

async function publishX(accessToken, content) {
  const text = composeText(content);
  if (!text) return blocked('x', 'Post text is empty');
  try {
    const res = await axios.post(
      'https://api.twitter.com/2/tweets',
      { text },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20000 },
    );
    const postId = res.data?.data?.id;
    if (!postId) return { success: false, platform: 'x', error: 'X did not return a post id' };
    return { success: true, platform: 'x', published: true, postId };
  } catch (err) {
    return { success: false, platform: 'x', error: apiError(err) };
  }
}

async function publishFacebook(accessToken, metadata, content) {
  const text = composeText(content);
  if (!text && !content.link) return blocked('facebook', 'Facebook post text is empty');
  let page;
  try {
    page = await resolvePage(accessToken, metadata);
  } catch (err) {
    return { success: false, platform: 'facebook', error: apiError(err) };
  }
  if (!page?.id || !(page.access_token || accessToken)) {
    return blocked('facebook', 'No Facebook Page was granted. Reconnect Facebook and select a Page.');
  }
  const version = metaGraphVersion();
  const pageToken = page.access_token || accessToken;
  try {
    if (content.imageUrl && !content.videoUrl) {
      const photo = await axios.post(
        `https://graph.facebook.com/${version}/${page.id}/photos`,
        {
          url: String(content.imageUrl),
          caption: text,
          access_token: pageToken,
        },
        { timeout: 20000 },
      );
      const postId = photo.data?.post_id || photo.data?.id;
      if (!postId) return { success: false, platform: 'facebook', error: 'Facebook did not return a photo post id' };
      return { success: true, platform: 'facebook', published: true, postId, pageId: page.id };
    }
    const res = await axios.post(
      `https://graph.facebook.com/${version}/${page.id}/feed`,
      {
        message: text,
        ...(content.link ? { link: content.link } : {}),
        access_token: pageToken,
      },
      { timeout: 20000 },
    );
    if (!res.data?.id) return { success: false, platform: 'facebook', error: 'Facebook did not return a post id' };
    return { success: true, platform: 'facebook', published: true, postId: res.data.id, pageId: page.id };
  } catch (err) {
    return { success: false, platform: 'facebook', error: apiError(err) };
  }
}

async function publishLinkedIn(accessToken, metadata, content) {
  const text = composeText(content);
  if (!text) return blocked('linkedin', 'LinkedIn post text is empty');
  let personUrn = metadata.personUrn;
  if (!personUrn) {
    try {
      const info = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      });
      const sub = info.data?.sub;
      if (sub) personUrn = String(sub).startsWith('urn:') ? String(sub) : `urn:li:person:${sub}`;
    } catch (err) {
      return { success: false, platform: 'linkedin', error: apiError(err) };
    }
  }
  if (!personUrn || personUrn === 'urn:li:person:me') {
    return blocked('linkedin', 'LinkedIn member id is missing. Reconnect LinkedIn (openid + w_member_social).');
  }
  try {
    const res = await axios.post(
      'https://api.linkedin.com/rest/posts',
      linkedInPostBody({ personUrn, text }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': process.env.LINKEDIN_VERSION || '202609',
        },
        timeout: 20000,
      },
    );
    const postId = res.headers?.['x-restli-id'] || res.data?.id;
    if (!postId) return { success: false, platform: 'linkedin', error: 'LinkedIn did not return a post id' };
    return { success: true, platform: 'linkedin', published: true, postId };
  } catch (err) {
    return { success: false, platform: 'linkedin', error: apiError(err) };
  }
}

export async function publishOrganic({ userId, platform, content = {}, pastedToken = null }) {
  const mapping = resolvePlatform(platform);
  if (!mapping || mapping.kind !== 'organic') {
    return blocked(platform, 'Not an organic publish platform');
  }
  const loaded = await loadAccess(userId, mapping, pastedToken);
  if (!loaded.accessToken) {
    return {
      success: false,
      platform: mapping.platform,
      fallback: true,
      published: false,
      error: `Connect ${mapping.label} before publishing`,
    };
  }
  try {
    switch (mapping.platform) {
      case 'x':
        return publishX(loaded.accessToken, content);
      case 'facebook':
        return publishFacebook(loaded.accessToken, loaded.metadata, content);
      case 'instagram':
        return publishInstagram(loaded.accessToken, loaded.metadata, content);
      case 'linkedin':
        return publishLinkedIn(loaded.accessToken, loaded.metadata, content);
      case 'youtube':
        return publishYouTube(loaded.accessToken, content);
      case 'tiktok':
        return publishTikTok(loaded.accessToken, content);
      default:
        return blocked(mapping.platform, 'Organic publisher is not implemented for this platform');
    }
  } catch (err) {
    return { success: false, platform: mapping.platform, error: apiError(err) };
  }
}

export async function finalizeOAuthAccount(mapping, tokenResult, creds) {
  let accessToken = tokenResult.accessToken;
  let refreshToken = tokenResult.refreshToken || null;
  let expiresAt = tokenResult.expiresAt || null;
  const metadata = {};
  if (tokenResult.raw?.open_id) metadata.openId = tokenResult.raw.open_id;

  if (['facebook', 'instagram', 'meta'].includes(mapping.platform)) {
    try {
      const long = await axios.get(`https://graph.facebook.com/${metaGraphVersion()}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          fb_exchange_token: accessToken,
        },
        timeout: 20000,
      });
      if (long.data?.access_token) {
        accessToken = long.data.access_token;
        if (long.data.expires_in) expiresAt = Date.now() + Number(long.data.expires_in) * 1000;
      }
    } catch (err) {
      metadata.longLivedWarning = apiError(err);
    }
    const pages = await listFacebookPages(accessToken);
    metadata.availablePages = pages.map((page) => ({
      id: page.id,
      name: page.name,
      igUserId: page.instagram_business_account?.id || null,
    }));
    const wanted = process.env.FACEBOOK_PAGE_ID;
    const page = (wanted && pages.find((item) => String(item.id) === String(wanted)))
      || pages.find((item) => item.instagram_business_account)
      || pages[0]
      || null;
    if (page) {
      metadata.pageId = page.id;
      metadata.pageName = page.name;
      if (page.access_token) metadata.pageAccessToken = page.access_token;
      if (page.instagram_business_account?.id) {
        metadata.igUserId = page.instagram_business_account.id;
        metadata.igUsername = page.instagram_business_account.username || null;
      }
    }
    if (mapping.platform === 'facebook' && !metadata.pageId) {
      const err = new Error('Facebook authorized, but no Page was granted. Reconnect and select a Page (pages_show_list, pages_manage_posts).');
      err.partialTokens = { accessToken, refreshToken, expiresAt, metadata };
      throw err;
    }
    if (mapping.platform === 'instagram' && !metadata.igUserId) {
      const err = new Error('Instagram authorized, but no professional Instagram account is linked to a Facebook Page.');
      err.partialTokens = { accessToken, refreshToken, expiresAt, metadata };
      throw err;
    }
  }

  if (mapping.platform === 'linkedin') {
    const info = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    const sub = info.data?.sub;
    if (!sub) throw new Error('LinkedIn did not return a member id. Enable the openid and profile products.');
    metadata.personUrn = String(sub).startsWith('urn:') ? String(sub) : `urn:li:person:${sub}`;
    metadata.memberName = info.data?.name || null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    scopes: tokenResult.scopes || [],
    metadata,
  };
}

export default { publishOrganic, finalizeOAuthAccount, composeText, linkedInPostBody, expiryMs };
