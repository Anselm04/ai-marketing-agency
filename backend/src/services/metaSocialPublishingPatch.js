import axios from 'axios';
import socialMediaService from './socialMediaService.js';

function blocked(platform, message, code) {
  return {
    success: false,
    published: false,
    blocked: true,
    platform,
    code,
    error: message,
  };
}

function metaVersion() {
  return process.env.META_GRAPH_VERSION || 'v26.0';
}

export function installMetaSocialPublishingPatch(service = socialMediaService) {
  if (!service || service.__metaSocialPublishingPatchApplied) return service;

  service.publishInstagram = async function publishInstagramImage(imageUrl, caption, options = {}) {
    const accessToken = this.tokens?.instagram;
    const userId = options.userId || process.env.INSTAGRAM_USER_ID;
    if (!accessToken || !userId) {
      return blocked(
        'instagram',
        'Instagram publishing requires an authenticated access token and INSTAGRAM_USER_ID.',
        'instagram_publishing_not_configured',
      );
    }
    if (!imageUrl) return blocked('instagram', 'A public image URL is required.', 'instagram_image_required');

    try {
      const graphVersion = metaVersion();
      const create = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${userId}/media`,
        new URLSearchParams({
          image_url: imageUrl,
          caption: String(caption || '').slice(0, 2200),
          access_token: accessToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
      );
      const creationId = create.data?.id;
      if (!creationId) return blocked('instagram', 'Instagram did not return a media container id.', 'instagram_container_missing');

      const publish = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${userId}/media_publish`,
        new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
      );
      const postId = publish.data?.id;
      if (!postId) return blocked('instagram', 'Instagram did not confirm the published media id.', 'instagram_publish_unconfirmed');
      return { success: true, published: true, platform: 'instagram', postId, containerId: creationId };
    } catch (error) {
      return {
        success: false,
        published: false,
        platform: 'instagram',
        code: error.response?.data?.error?.code || 'instagram_publish_failed',
        error: error.response?.data?.error?.message || error.message,
      };
    }
  };

  service.publishFacebook = async function publishFacebookPagePost(message, link, options = {}) {
    const accessToken = this.tokens?.facebook;
    const pageId = options.pageId || process.env.FACEBOOK_PAGE_ID;
    if (!accessToken || !pageId) {
      return blocked(
        'facebook',
        'Facebook publishing requires an authenticated Page access token and FACEBOOK_PAGE_ID.',
        'facebook_publishing_not_configured',
      );
    }

    try {
      const graphVersion = metaVersion();
      const payload = new URLSearchParams({
        message: String(message || '').slice(0, 63206),
        access_token: accessToken,
      });
      if (link) payload.set('link', String(link));
      const response = await axios.post(
        `https://graph.facebook.com/${graphVersion}/${pageId}/feed`,
        payload,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 },
      );
      const postId = response.data?.id;
      if (!postId) return blocked('facebook', 'Facebook did not confirm the published Page post id.', 'facebook_publish_unconfirmed');
      return { success: true, published: true, platform: 'facebook', postId };
    } catch (error) {
      return {
        success: false,
        published: false,
        platform: 'facebook',
        code: error.response?.data?.error?.code || 'facebook_publish_failed',
        error: error.response?.data?.error?.message || error.message,
      };
    }
  };

  Object.defineProperty(service, '__metaSocialPublishingPatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export default installMetaSocialPublishingPatch;
