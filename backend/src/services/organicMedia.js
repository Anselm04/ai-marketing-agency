/**
 * Image and video organic adapters used by organicPublisher.
 */
import axios from 'axios';
import socialMediaService from './socialMediaService.js';
import { metaGraphVersion } from './oauthPlatforms.js';
import {
  apiError,
  blocked,
  composeText,
  resolvePage,
} from './organicPublisher.js';

const MAX_VIDEO_BYTES = Number(process.env.SOCIAL_VIDEO_MAX_BYTES) || 256 * 1024 * 1024;

export async function publishInstagram(accessToken, metadata, content) {
  let page;
  try {
    page = await resolvePage(accessToken, metadata, { instagram: true });
  } catch (err) {
    return { success: false, platform: 'instagram', error: apiError(err) };
  }
  const igUserId = metadata.igUserId
    || page?.instagram_business_account?.id
    || process.env.INSTAGRAM_USER_ID
    || null;
  const pageToken = metadata.pageAccessToken || page?.access_token || accessToken;
  if (!igUserId) {
    return blocked('instagram', 'No Instagram professional account is linked to a Facebook Page on this login.');
  }
  const caption = composeText(content).slice(0, 2200);
  const version = metaGraphVersion();
  if (content.videoUrl) {
    if (!process.env.META_GRAPH_VERSION) process.env.META_GRAPH_VERSION = metaGraphVersion();
    const svc = socialMediaService.withUserTokens({ instagram: pageToken });
    const raw = await svc.publishInstagramReel(content.videoUrl, caption, { userId: igUserId });
    return {
      ...raw,
      platform: 'instagram',
      postId: raw.postId,
      published: !!(raw.success && raw.postId),
      error: raw.error || raw.message,
    };
  }
  if (!content.imageUrl) {
    return blocked('instagram', 'Instagram organic posts require a public imageUrl or videoUrl. Text-only posts are not supported.');
  }
  try {
    const create = await axios.post(
      `https://graph.facebook.com/${version}/${igUserId}/media`,
      new URLSearchParams({
        image_url: String(content.imageUrl),
        caption,
        access_token: pageToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
    );
    const containerId = create.data?.id;
    if (!containerId) return { success: false, platform: 'instagram', error: 'Instagram did not return a media container id' };
    let statusCode = 'IN_PROGRESS';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 3000));
      const statusRes = await axios.get(`https://graph.facebook.com/${version}/${containerId}`, {
        params: { fields: 'status_code,status', access_token: pageToken },
        timeout: 15000,
      });
      statusCode = statusRes.data?.status_code || statusCode;
      if (statusCode === 'FINISHED') break;
      if (['ERROR', 'EXPIRED'].includes(statusCode)) {
        return { success: false, platform: 'instagram', error: statusRes.data?.status || `Instagram container ${statusCode}`, containerId };
      }
    }
    if (statusCode !== 'FINISHED') {
      return { success: false, platform: 'instagram', pending: true, containerId, error: 'Instagram is still processing the image container' };
    }
    const publish = await axios.post(
      `https://graph.facebook.com/${version}/${igUserId}/media_publish`,
      new URLSearchParams({ creation_id: containerId, access_token: pageToken }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
    );
    if (!publish.data?.id) return { success: false, platform: 'instagram', error: 'Instagram did not return a published media id', containerId };
    return { success: true, platform: 'instagram', published: true, postId: publish.data.id, containerId };
  } catch (err) {
    return { success: false, platform: 'instagram', error: apiError(err) };
  }
}

function assertPublicHttps(raw) {
  let url;
  try { url = new URL(String(raw)); } catch { return 'Video URL is not valid'; }
  if (url.protocol !== 'https:') return 'Video URL must be https';
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') return 'Video URL host is not allowed';
  return null;
}

export async function publishYouTube(accessToken, content) {
  if (!content.videoUrl) {
    return blocked('youtube', 'YouTube has no text-post API. Provide a public https videoUrl (privacy follows YOUTUBE_PRIVACY_STATUS, default private).');
  }
  const bad = assertPublicHttps(content.videoUrl);
  if (bad) return blocked('youtube', bad);
  const source = await axios.get(content.videoUrl, {
    responseType: 'stream',
    timeout: 30000,
    maxRedirects: 3,
    maxContentLength: MAX_VIDEO_BYTES,
  });
  const contentType = source.headers['content-type'] || 'video/mp4';
  const contentLength = source.headers['content-length'];
  const text = composeText(content);
  const metadata = {
    snippet: {
      title: String(content.title || text || 'Video').slice(0, 100),
      description: text.slice(0, 5000),
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'private',
      selfDeclaredMadeForKids: false,
    },
  };
  const init = await axios.post(
    'https://www.googleapis.com/upload/youtube/v3/videos',
    metadata,
    {
      params: { uploadType: 'resumable', part: 'snippet,status' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        ...(contentLength ? { 'X-Upload-Content-Length': contentLength } : {}),
      },
      timeout: 20000,
      maxRedirects: 0,
    },
  );
  const uploadUrl = init.headers.location;
  if (!uploadUrl) return { success: false, platform: 'youtube', error: 'YouTube did not return a resumable upload URL' };
  const upload = await axios.put(uploadUrl, source.data, {
    headers: {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': contentLength } : {}),
    },
    timeout: 5 * 60_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  if (!upload.data?.id) return { success: false, platform: 'youtube', error: 'YouTube did not return a video id' };
  return {
    success: true,
    platform: 'youtube',
    published: true,
    postId: upload.data.id,
    privacyStatus: metadata.status.privacyStatus,
  };
}

export async function publishTikTok(accessToken, content) {
  if (!content.videoUrl) {
    return blocked('tiktok', 'TikTok organic publish requires a public videoUrl. Text-only posts are not supported.');
  }
  const svc = socialMediaService.withUserTokens({ tiktok: accessToken });
  const raw = await svc.publishTikTok(content.videoUrl, composeText(content), content.hashtags || [], {
    privacyLevel: content.privacyLevel || process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY',
  });
  const postId = raw.postId || raw.publishId || null;
  return {
    ...raw,
    platform: 'tiktok',
    postId,
    published: !!(raw.success && postId),
    error: raw.error || (!postId ? raw.message : undefined),
  };
}
