import axios from 'axios';
import { getConnectorById } from './connectors/index.js';
import { ensureValidToken, getTokens } from './appConnector.js';
import { getVideoPlatform } from './videoPlatformCatalog.js';

const MAX_REMOTE_VIDEO_BYTES = Number(process.env.SOCIAL_VIDEO_MAX_BYTES) || 256 * 1024 * 1024;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202609';

function normalizePlatformId(value) {
  const key = String(value || '').trim().toLowerCase();
  const aliases = {
    'x (twitter)': 'x',
    'twitter/x': 'x',
    twitter: 'x',
    'rednote / xiaohongshu': 'rednote',
    xiaohongshu: 'rednote',
    'warpcast / farcaster': 'warpcast',
    farcaster: 'warpcast',
  };
  return aliases[key] || key.replace(/\s+/g, '_');
}

function textWithHashtags(caption, hashtags = []) {
  const tags = (Array.isArray(hashtags) ? hashtags : [])
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  return [caption, ...tags].filter(Boolean).join(' ').trim();
}

async function fetchMediaBuffer(mediaUrl) {
  if (!mediaUrl) throw new Error('A public mediaUrl is required');
  const response = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxContentLength: MAX_REMOTE_VIDEO_BYTES,
    maxBodyLength: MAX_REMOTE_VIDEO_BYTES,
    maxRedirects: 3,
  });
  const buffer = Buffer.from(response.data);
  if (!buffer.length) throw new Error('Video source returned an empty file');
  if (buffer.length > MAX_REMOTE_VIDEO_BYTES) throw new Error('Video exceeds SOCIAL_VIDEO_MAX_BYTES');
  return {
    buffer,
    contentType: response.headers['content-type'] || 'video/mp4',
    size: buffer.length,
  };
}

async function requireUserToken(userId, connectorId) {
  const connector = getConnectorById(connectorId);
  if (!connector) throw new Error(`Connector ${connectorId} is not configured`);
  const stored = await getTokens(userId, connectorId);
  if (!stored) {
    const error = new Error(`Connect your ${connector.name} account before publishing`);
    error.code = 'ACCOUNT_NOT_CONNECTED';
    throw error;
  }
  const accessToken = await ensureValidToken(userId, connectorId, connector);
  if (!accessToken) throw new Error(`${connector.name} authorization is unavailable or expired`);
  return { connector, accessToken, stored };
}

async function waitForMetaContainer(accessToken, containerId, graphHost = 'https://graph.facebook.com') {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
    const response = await axios.get(
      `${graphHost}/${META_GRAPH_VERSION}/${containerId}`,
      {
        params: { fields: 'status_code,status,error_message', access_token: accessToken },
        timeout: 15_000,
      },
    );
    const status = response.data?.status_code || response.data?.status;
    if (['FINISHED', 'PUBLISHED'].includes(status)) return response.data;
    if (['ERROR', 'EXPIRED'].includes(status)) {
      throw new Error(response.data?.error_message || `Media processing failed: ${status}`);
    }
  }
  throw new Error('Media processing did not finish before timeout');
}

async function findFacebookPage(accessToken, requestedPageId = null) {
  const response = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`, {
    params: { fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: accessToken },
    timeout: 20_000,
  });
  const pages = response.data?.data || [];
  if (!pages.length) throw new Error('No Facebook Page is available for this connected account');
  const page = requestedPageId ? pages.find((item) => String(item.id) === String(requestedPageId)) : pages[0];
  if (!page) throw new Error('The selected Facebook Page is not available to this user');
  return page;
}

class UserVideoPublisherService {
  async listConnectionStatus(userId, platforms) {
    return Promise.all(platforms.map(async (platform) => {
      if (!platform.connectorId) return { ...platform, connected: false };
      const tokens = await getTokens(userId, platform.connectorId);
      return { ...platform, connected: Boolean(tokens) };
    }));
  }

  async publish({ userId, platformId, mediaUrl, title = '', caption = '', hashtags = [], settings = {} }) {
    const normalizedId = normalizePlatformId(platformId);
    const platform = getVideoPlatform(normalizedId);
    if (!platform) {
      return { platform: normalizedId, success: false, blocked: true, error: 'Unknown video platform' };
    }

    if (platform.publish !== 'direct_api') {
      return {
        platform: normalizedId,
        success: false,
        blocked: true,
        capability: platform.publish,
        error: platform.note || 'This platform does not expose a production-ready third-party video upload API for this workflow.',
      };
    }

    try {
      switch (normalizedId) {
        case 'tiktok':
          return await this.publishTikTok(userId, mediaUrl, caption, hashtags, settings);
        case 'instagram':
          return await this.publishInstagram(userId, mediaUrl, caption, hashtags, settings);
        case 'youtube':
          return await this.publishYouTube(userId, mediaUrl, title, caption, hashtags, settings);
        case 'facebook':
          return await this.publishFacebook(userId, mediaUrl, title, caption, hashtags, settings);
        case 'threads':
          return await this.publishThreads(userId, mediaUrl, caption, hashtags, settings);
        case 'pinterest':
          return await this.publishPinterest(userId, mediaUrl, title, caption, settings);
        case 'linkedin':
          return await this.publishLinkedIn(userId, mediaUrl, title, caption, hashtags, settings);
        default:
          return {
            platform: normalizedId,
            success: false,
            blocked: true,
            error: 'This platform is catalogued but its direct video publishing adapter is not implemented yet.',
          };
      }
    } catch (error) {
      return {
        platform: normalizedId,
        success: false,
        blocked: error.code === 'ACCOUNT_NOT_CONNECTED',
        error: error.response?.data?.error?.message
          || error.response?.data?.message
          || error.message,
        code: error.response?.data?.error?.code || error.code || error.response?.status,
      };
    }
  }

  async publishMany({ userId, platformIds = [], settings = {}, ...payload }) {
    const unique = [...new Set(platformIds.map(normalizePlatformId).filter(Boolean))];
    const results = [];
    for (const platformId of unique) {
      const platformSettings = settings?.[platformId] || settings || {};
      results.push(await this.publish({
        userId,
        platformId,
        ...payload,
        settings: platformSettings,
      }));
    }
    return results;
  }

  async publishTikTok(userId, mediaUrl, caption, hashtags, settings) {
    const { accessToken } = await requireUserToken(userId, 'tiktok');
    const creatorInfo = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
        timeout: 20_000,
      },
    );
    if (creatorInfo.data?.error?.code && creatorInfo.data.error.code !== 'ok') {
      throw new Error(creatorInfo.data.error.message || creatorInfo.data.error.code);
    }

    const allowedPrivacy = creatorInfo.data?.data?.privacy_level_options || [];
    const privacyLevel = settings.privacyLevel || process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
    if (allowedPrivacy.length && !allowedPrivacy.includes(privacyLevel)) {
      throw new Error(`TikTok privacy level ${privacyLevel} is not allowed for this account`);
    }

    const response = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        post_info: {
          title: textWithHashtags(caption, hashtags).slice(0, 2200),
          privacy_level: privacyLevel,
          disable_duet: settings.disableDuet === true,
          disable_comment: settings.disableComment === true,
          disable_stitch: settings.disableStitch === true,
          brand_organic_toggle: settings.brandOrganic === true,
          is_aigc: settings.isAigc === true,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: mediaUrl },
      },
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
        timeout: 20_000,
      },
    );

    if (response.data?.error?.code && response.data.error.code !== 'ok') {
      throw new Error(response.data.error.message || response.data.error.code);
    }
    return {
      platform: 'tiktok',
      success: true,
      submitted: true,
      published: false,
      publishId: response.data?.data?.publish_id,
      privacyLevel,
    };
  }

  async publishInstagram(userId, mediaUrl, caption, hashtags, settings) {
    const { accessToken } = await requireUserToken(userId, 'meta_instagram');
    const page = await findFacebookPage(accessToken, settings.pageId);
    const instagramId = settings.instagramUserId || page.instagram_business_account?.id;
    if (!instagramId) throw new Error('No Instagram professional account is linked to the selected Facebook Page');
    const pageToken = page.access_token || accessToken;

    const create = await axios.post(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${instagramId}/media`,
      new URLSearchParams({
        media_type: 'REELS',
        video_url: mediaUrl,
        caption: textWithHashtags(caption, hashtags).slice(0, 2200),
        share_to_feed: settings.shareToFeed === false ? 'false' : 'true',
        access_token: pageToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
    );
    const containerId = create.data?.id;
    if (!containerId) throw new Error('Instagram did not return a media container');

    await waitForMetaContainer(pageToken, containerId);
    const published = await axios.post(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${instagramId}/media_publish`,
      new URLSearchParams({ creation_id: containerId, access_token: pageToken }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
    );

    return {
      platform: 'instagram',
      success: true,
      published: true,
      postId: published.data?.id,
      containerId,
      accountId: instagramId,
    };
  }

  async publishFacebook(userId, mediaUrl, title, caption, hashtags, settings) {
    const { accessToken } = await requireUserToken(userId, 'meta_facebook');
    const page = await findFacebookPage(accessToken, settings.pageId);
    const pageToken = page.access_token || accessToken;

    const start = await axios.post(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/video_reels`,
      new URLSearchParams({ upload_phase: 'start', access_token: pageToken }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
    );
    const uploadUrl = start.data?.upload_url;
    const videoId = start.data?.video_id;
    if (!uploadUrl || !videoId) throw new Error('Facebook did not return a Reels upload session');

    await axios.post(uploadUrl, null, {
      headers: {
        Authorization: `OAuth ${pageToken}`,
        file_url: mediaUrl,
      },
      timeout: 60_000,
      maxRedirects: 0,
    });

    const finish = await axios.post(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/video_reels`,
      new URLSearchParams({
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        title: String(title || '').slice(0, 255),
        description: textWithHashtags(caption, hashtags).slice(0, 5000),
        access_token: pageToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20_000 },
    );

    return {
      platform: 'facebook',
      success: finish.data?.success !== false,
      submitted: true,
      published: false,
      videoId,
      pageId: page.id,
    };
  }

  async publishThreads(userId, mediaUrl, caption, hashtags) {
    const { accessToken, stored } = await requireUserToken(userId, 'threads');
    let threadsUserId = stored.account?.userId || stored.account?.openId;
    if (!threadsUserId) {
      const me = await axios.get('https://graph.threads.net/v1.0/me', {
        params: { fields: 'id,username', access_token: accessToken },
        timeout: 15_000,
      });
      threadsUserId = me.data?.id;
    }
    if (!threadsUserId) throw new Error('Threads user id could not be resolved');

    const create = await axios.post(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads`,
      null,
      {
        params: {
          media_type: 'VIDEO',
          video_url: mediaUrl,
          text: textWithHashtags(caption, hashtags).slice(0, 500),
          access_token: accessToken,
        },
        timeout: 20_000,
      },
    );
    const creationId = create.data?.id;
    if (!creationId) throw new Error('Threads did not return a media container');

    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
      const status = await axios.get(`https://graph.threads.net/v1.0/${creationId}`, {
        params: { fields: 'status,error_message', access_token: accessToken },
        timeout: 15_000,
      });
      if (status.data?.status === 'FINISHED') break;
      if (status.data?.status === 'ERROR') throw new Error(status.data?.error_message || 'Threads video processing failed');
      if (attempt === 11) throw new Error('Threads video processing did not finish before timeout');
    }

    const publish = await axios.post(
      `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`,
      null,
      { params: { creation_id: creationId, access_token: accessToken }, timeout: 20_000 },
    );
    return {
      platform: 'threads',
      success: true,
      published: true,
      postId: publish.data?.id,
      containerId: creationId,
    };
  }

  async publishYouTube(userId, mediaUrl, title, caption, hashtags, settings) {
    const { accessToken } = await requireUserToken(userId, 'youtube');
    const source = await axios.get(mediaUrl, {
      responseType: 'stream',
      timeout: 30_000,
      maxRedirects: 3,
    });
    const contentType = source.headers['content-type'] || 'video/mp4';
    const contentLength = source.headers['content-length'];

    const metadata = {
      snippet: {
        title: String(title || 'Video').slice(0, 100),
        description: textWithHashtags(caption, hashtags).slice(0, 5000),
        tags: (hashtags || []).map((tag) => String(tag).replace(/^#/, '')).slice(0, 30),
      },
      status: {
        privacyStatus: settings.privacyStatus || process.env.YOUTUBE_PRIVACY_STATUS || 'private',
        selfDeclaredMadeForKids: settings.madeForKids === true,
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
        timeout: 20_000,
        maxRedirects: 0,
      },
    );
    const uploadUrl = init.headers.location;
    if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL');

    const upload = await axios.put(uploadUrl, source.data, {
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
      },
      timeout: 5 * 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return {
      platform: 'youtube',
      success: true,
      published: true,
      postId: upload.data?.id,
      privacyStatus: metadata.status.privacyStatus,
    };
  }

  async publishPinterest(userId, mediaUrl, title, caption, settings) {
    const { accessToken } = await requireUserToken(userId, 'pinterest');
    if (!settings.boardId) throw new Error('Choose a Pinterest board before publishing a video Pin');
    if (!settings.coverImageUrl) throw new Error('Pinterest video Pins require a public coverImageUrl');

    const register = await axios.post(
      'https://api.pinterest.com/v5/media',
      { media_type: 'video' },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 20_000 },
    );
    const { media_id: mediaId, upload_url: uploadUrl, upload_parameters: uploadParameters } = register.data || {};
    if (!mediaId || !uploadUrl || !uploadParameters) throw new Error('Pinterest did not return a media upload session');

    const { buffer, contentType } = await fetchMediaBuffer(mediaUrl);
    const form = new globalThis.FormData();
    for (const [key, value] of Object.entries(uploadParameters)) form.append(key, String(value));
    form.append('file', new globalThis.Blob([buffer], { type: contentType }), 'video.mp4');

    await axios.post(uploadUrl, form, {
      timeout: 5 * 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    let ready = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
      const status = await axios.get(`https://api.pinterest.com/v5/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15_000,
      });
      const state = String(status.data?.status || '').toLowerCase();
      if (['succeeded', 'success'].includes(state)) {
        ready = true;
        break;
      }
      if (['failed', 'failure'].includes(state)) throw new Error('Pinterest video processing failed');
    }
    if (!ready) throw new Error('Pinterest video processing did not finish before timeout');

    const pin = await axios.post(
      'https://api.pinterest.com/v5/pins',
      {
        board_id: String(settings.boardId),
        title: String(title || '').slice(0, 100),
        description: String(caption || '').slice(0, 800),
        media_source: {
          source_type: 'video_id',
          cover_image_url: settings.coverImageUrl,
          media_id: mediaId,
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 20_000 },
    );

    return {
      platform: 'pinterest',
      success: true,
      published: true,
      postId: pin.data?.id,
      mediaId,
    };
  }

  async publishLinkedIn(userId, mediaUrl, title, caption, hashtags, settings) {
    const { accessToken } = await requireUserToken(userId, 'linkedin');
    let ownerUrn = settings.ownerUrn;

    if (!ownerUrn) {
      const me = await axios.get('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15_000,
      });
      if (me.data?.id) ownerUrn = `urn:li:person:${me.data.id}`;
    }
    if (!ownerUrn) throw new Error('LinkedIn member identity could not be resolved');

    const { buffer, contentType, size } = await fetchMediaBuffer(mediaUrl);
    const commonHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };

    const initialize = await axios.post(
      'https://api.linkedin.com/rest/videos?action=initializeUpload',
      {
        initializeUploadRequest: {
          owner: ownerUrn,
          fileSizeBytes: size,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      },
      { headers: commonHeaders, timeout: 20_000 },
    );

    const value = initialize.data?.value || {};
    const videoUrn = value.video;
    const uploadToken = value.uploadToken || '';
    const instructions = value.uploadInstructions || [];
    if (!videoUrn || !instructions.length) throw new Error('LinkedIn did not return video upload instructions');

    const uploadedPartIds = [];
    for (const instruction of instructions) {
      const first = Number(instruction.firstByte || 0);
      const last = Number(instruction.lastByte ?? (size - 1));
      const chunk = buffer.subarray(first, Math.min(last + 1, buffer.length));
      const response = await axios.put(instruction.uploadUrl, chunk, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunk.length,
        },
        timeout: 2 * 60_000,
        maxBodyLength: Infinity,
      });
      const partId = response.headers.etag || response.headers['x-li-upload-part-id'];
      if (!partId) throw new Error('LinkedIn upload did not return a part identifier');
      uploadedPartIds.push(String(partId).replace(/^"|"$/g, ''));
    }

    await axios.post(
      'https://api.linkedin.com/rest/videos?action=finalizeUpload',
      { finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds } },
      { headers: commonHeaders, timeout: 20_000 },
    );

    const post = await axios.post(
      'https://api.linkedin.com/rest/posts',
      {
        author: ownerUrn,
        commentary: textWithHashtags(caption, hashtags).slice(0, 3000),
        visibility: settings.visibility || 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: {
            id: videoUrn,
            title: String(title || '').slice(0, 200),
          },
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: settings.disableReshare === true,
      },
      { headers: commonHeaders, timeout: 20_000 },
    );

    return {
      platform: 'linkedin',
      success: true,
      published: true,
      postId: post.headers['x-restli-id'] || post.data?.id,
      videoUrn,
      ownerUrn,
    };
  }
}

export default new UserVideoPublisherService();
