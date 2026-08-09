import axios from 'axios';

class SocialMediaService {
  constructor() {
    this.tokens = {
      tiktok: process.env.TIKTOK_ACCESS_TOKEN,
      meta: process.env.META_ACCESS_TOKEN,
      instagram: process.env.INSTAGRAM_ACCESS_TOKEN,
      youtube: process.env.YOUTUBE_API_KEY,
    };
  }

  isAvailable(platform) {
    return !!this.tokens[platform];
  }

  async publishTikTok(videoUrl, caption, hashtags = []) {
    if (!this.isAvailable('tiktok')) {
      return { fallback: true, message: 'TikTok API not configured. Would publish: ' + caption };
    }
    try {
      const response = await axios.post('https://open-api.tiktok.com/share/video/upload/', {
        access_token: this.tokens.tiktok,
        source_info: { source: 'PULL_FROM_URL', url: videoUrl },
        title: caption + ' ' + hashtags.join(' '),
      });
      return { success: true, platform: 'tiktok', postId: response.data.data.share_id };
    } catch (err) {
      return { success: false, platform: 'tiktok', error: err.message };
    }
  }

  async publishInstagram(imageUrl, caption) {
    if (!this.isAvailable('instagram')) {
      return { fallback: true, message: 'Instagram API not configured. Would publish: ' + caption };
    }
    try {
      const response = await axios.post(`https://graph.facebook.com/v18.0/me/media`, {
        image_url: imageUrl,
        caption,
        access_token: this.tokens.instagram,
      });
      return { success: true, platform: 'instagram', postId: response.data.id };
    } catch (err) {
      return { success: false, platform: 'instagram', error: err.message };
    }
  }

  async publishMetaAd(adSetId, creative, status = 'PAUSED') {
    if (!this.isAvailable('meta')) {
      return { fallback: true, message: 'Meta Ads API not configured. Would create ad: ' + creative.name };
    }
    try {
      const response = await axios.post(`https://graph.facebook.com/v18.0/${adSetId}/ads`, {
        name: creative.name,
        adset_id: adSetId,
        creative: { creative_id: creative.id },
        status,
        access_token: this.tokens.meta,
      });
      return { success: true, platform: 'meta', adId: response.data.id };
    } catch (err) {
      return { success: false, platform: 'meta', error: err.message };
    }
  }

  async getYouTubeAnalytics(channelId, metrics = ['views', 'subscribersGained']) {
    if (!this.isAvailable('youtube')) {
      return { fallback: true, message: 'YouTube API not configured. Would fetch analytics for: ' + channelId };
    }
    try {
      const response = await axios.get('https://youtubeanalytics.googleapis.com/v2/reports', {
        params: {
          ids: `channel==${channelId}`,
          metrics: metrics.join(','),
          startDate: '2025-01-01',
          endDate: new Date().toISOString().split('T')[0],
          key: this.tokens.youtube,
        },
      });
      return { success: true, platform: 'youtube', data: response.data };
    } catch (err) {
      return { success: false, platform: 'youtube', error: err.message };
    }
  }

  async getAllPlatformStatus() {
    return [
      { platform: 'tiktok', connected: this.isAvailable('tiktok'), name: 'TikTok' },
      { platform: 'instagram', connected: this.isAvailable('instagram'), name: 'Instagram' },
      { platform: 'meta', connected: this.isAvailable('meta'), name: 'Meta Ads' },
      { platform: 'youtube', connected: this.isAvailable('youtube'), name: 'YouTube' },
    ];
  }

  async publishToAll(content) {
    const results = [];
    if (content.tiktok) results.push(await this.publishTikTok(content.videoUrl, content.caption, content.hashtags));
    if (content.instagram) results.push(await this.publishInstagram(content.imageUrl, content.caption));
    if (content.meta) results.push(await this.publishMetaAd(content.adSetId, content.creative, content.status));
    return results;
  }
}

export default new SocialMediaService();
