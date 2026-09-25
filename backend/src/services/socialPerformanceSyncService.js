
import axios from 'axios';
import { getConnectorById } from './connectors/index.js';
import { ensureValidToken, getTokens } from './appConnector.js';
import autoPostingAnalyticsService from './autoPostingAnalyticsService.js';

async function tokenFor(userId, connectorId) {
  const connector = getConnectorById(connectorId);
  if (!connector) throw new Error('Connector not found: ' + connectorId);
  const stored = await getTokens(userId, connectorId);
  if (!stored) throw new Error('Account not connected: ' + connectorId);
  const accessToken = await ensureValidToken(userId, connectorId, connector);
  if (!accessToken) throw new Error('Authorization unavailable: ' + connectorId);
  return accessToken;
}

function resultFor(run, platform) {
  return (run.results || []).find((item) => item.platform === platform) || null;
}

class SocialPerformanceSyncService {
  async syncYouTube(owner, plan, run) {
    const published = resultFor(run, 'youtube');
    if (!published?.postId) return { platform: 'youtube', skipped: true, reason: 'No YouTube video id yet' };

    const accessToken = await tokenFor(owner, 'youtube');
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'statistics', id: published.postId },
      headers: { Authorization: 'Bearer ' + accessToken },
      timeout: 20000,
    });
    const stats = response.data?.items?.[0]?.statistics;
    if (!stats) return { platform: 'youtube', skipped: true, reason: 'Statistics unavailable' };

    const record = await autoPostingAnalyticsService.recordMetrics({
      owner,
      planId: plan.id,
      runId: run.id,
      platformId: 'youtube',
      metrics: {
        views: stats.viewCount,
        likes: stats.likeCount,
        comments: stats.commentCount,
      },
    });

    return { platform: 'youtube', success: true, recordId: record.id };
  }

  async syncTikTok(owner, plan, run) {
    const published = resultFor(run, 'tiktok');
    if (!published?.publishId) return { platform: 'tiktok', skipped: true, reason: 'No TikTok publish id yet' };

    const accessToken = await tokenFor(owner, 'tiktok');
    const status = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      { publish_id: published.publishId },
      {
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        timeout: 20000,
      },
    );

    const ids = status.data?.data?.publicaly_available_post_id || [];
    if (!ids.length) {
      return {
        platform: 'tiktok',
        skipped: true,
        reason: status.data?.data?.status || 'TikTok post is not publicly queryable yet',
      };
    }

    const response = await axios.post(
      'https://open.tiktokapis.com/v2/video/query/',
      { filters: { video_ids: ids.map(String).slice(0, 20) } },
      {
        params: { fields: 'id,view_count,like_count,comment_count,share_count' },
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        timeout: 20000,
      },
    );

    const video = response.data?.data?.videos?.[0];
    if (!video) return { platform: 'tiktok', skipped: true, reason: 'TikTok statistics unavailable' };

    const record = await autoPostingAnalyticsService.recordMetrics({
      owner,
      planId: plan.id,
      runId: run.id,
      platformId: 'tiktok',
      metrics: {
        views: video.view_count,
        likes: video.like_count,
        comments: video.comment_count,
        shares: video.share_count,
      },
    });

    return { platform: 'tiktok', success: true, recordId: record.id };
  }

  async syncPlan(plan) {
    const runs = (plan.recentRuns || []).slice(0, 20);
    const results = [];

    for (const run of runs) {
      const platforms = new Set((run.results || []).map((item) => item.platform));
      if (platforms.has('youtube')) {
        try {
          results.push(await this.syncYouTube(plan.owner, plan, run));
        } catch (error) {
          results.push({ platform: 'youtube', success: false, error: error.message });
        }
      }
      if (platforms.has('tiktok')) {
        try {
          results.push(await this.syncTikTok(plan.owner, plan, run));
        } catch (error) {
          results.push({ platform: 'tiktok', success: false, error: error.message });
        }
      }
    }

    return {
      syncedAt: new Date().toISOString(),
      results,
      successful: results.filter((item) => item.success).length,
    };
  }
}

export default new SocialPerformanceSyncService();
