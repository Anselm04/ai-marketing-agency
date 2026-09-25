import store from '../utils/store.js';
import clippingAgencyService from './clippingAgencyService.js';
import mediaClipperService from './mediaClipperService.js';

function campaignOwnerId(campaign) {
  return campaign.owner || campaign.ownerId;
}

function assertRunnable(campaign) {
  const rights = clippingAgencyService.validateRightsManifest(campaign.rightsManifest);
  if (!rights.valid) {
    const error = new Error('Rights verification failed');
    error.code = 'RIGHTS_VERIFICATION_FAILED';
    error.details = rights.errors;
    throw error;
  }
  if (!campaign.autonomous?.enabled) {
    const error = new Error('Autonomous mode is not enabled');
    error.code = 'AUTONOMOUS_MODE_DISABLED';
    throw error;
  }
}

class ClippingAutomationService {
  async runCampaignCycle(campaignInput, options = {}) {
    let campaign = campaignInput;
    assertRunnable(campaign);

    const cycle = {
      startedAt: new Date().toISOString(),
      transcribed: false,
      planned: false,
      rendered: [],
      published: [],
      submitted: [],
      blocked: [],
    };

    try {
      if (!campaign.transcript && campaign.sourceUrl) {
        const transcription = await mediaClipperService.transcribeSource(campaign.sourceUrl);
        campaign = await store.updateCampaign(campaign.id, {
          transcript: transcription.transcript,
          sourceDurationSeconds: transcription.durationSeconds,
          transcription: {
            completedAt: new Date().toISOString(),
            chunks: transcription.chunks,
            model: transcription.model,
          },
        });
        cycle.transcribed = true;
      }

      if (!campaign.clipPlan?.clips?.length) {
        const plan = await clippingAgencyService.generateClipPlan(campaign);
        const scheduledClips = clippingAgencyService.scheduleClips(plan.clips, {
          intervalMinutes: campaign.autonomous?.intervalMinutes,
        });
        campaign = await store.updateCampaign(campaign.id, {
          clipPlan: { ...plan, clips: scheduledClips },
          status: 'running',
        });
        cycle.planned = true;
      }

      const now = Number(options.now) || Date.now();
      const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 1, 3));
      const dueIds = campaign.clipPlan.clips
        .filter((clip) => {
          if (['published', 'submitted', 'publishing'].includes(clip.status)) return false;
          if (clip.nextAutomationAttemptAt && new Date(clip.nextAutomationAttemptAt).getTime() > now) return false;
          if (!clip.scheduledAt) return true;
          return new Date(clip.scheduledAt).getTime() <= now;
        })
        .slice(0, batchSize)
        .map((clip) => String(clip.id));

      const clips = [];
      for (const existing of campaign.clipPlan.clips) {
        if (!dueIds.includes(String(existing.id))) {
          clips.push(existing);
          continue;
        }

        let clip = existing;
        try {
          if (!clip.mediaUrl) {
            if (!campaign.sourceUrl) {
              cycle.blocked.push({ clipId: clip.id, reason: 'sourceUrl missing' });
              clips.push({
                ...clip,
                status: 'awaiting_media',
                nextAutomationAttemptAt: new Date(now + 60 * 60 * 1000).toISOString(),
              });
              continue;
            }

            const rendered = await mediaClipperService.renderClip({
              sourceUrl: campaign.sourceUrl,
              startSeconds: clip.startSeconds,
              endSeconds: clip.endSeconds,
              ownerId: campaignOwnerId(campaign),
              campaignId: campaign.id,
              clipId: clip.id,
            });
            clip = {
              ...clip,
              mediaUrl: rendered.mediaUrl,
              storage: rendered.storage,
              storageKey: rendered.key || null,
              localPath: rendered.localPath || null,
              renderedAt: new Date().toISOString(),
              status: rendered.mediaUrl ? 'ready' : 'rendered_private',
              nextAutomationAttemptAt: null,
            };
            cycle.rendered.push(clip.id);
          }

          if (!clip.mediaUrl) {
            cycle.blocked.push({ clipId: clip.id, reason: 'public durable media URL unavailable' });
            clips.push({
              ...clip,
              nextAutomationAttemptAt: new Date(now + 60 * 60 * 1000).toISOString(),
            });
            continue;
          }

          if (campaign.autonomous?.humanApprovalRequiredBeforeFirstPublish === true) {
            cycle.blocked.push({ clipId: clip.id, reason: 'first-publish approval required' });
            clips.push({
              ...clip,
              nextAutomationAttemptAt: new Date(now + 60 * 60 * 1000).toISOString(),
            });
            continue;
          }

          const results = await clippingAgencyService.publishClip(
            clip,
            campaign.publishingSettings || {},
          );
          const accepted = results.some((result) => result?.success === true);
          const confirmedPublished = results.some(
            (result) => result?.success === true && result?.published === true,
          );
          clip = {
            ...clip,
            publishResults: [...(clip.publishResults || []), ...results],
            lastPublishAttemptAt: new Date().toISOString(),
            status: confirmedPublished ? 'published' : accepted ? 'submitted' : 'publish_blocked',
            nextAutomationAttemptAt: accepted
              ? null
              : new Date(now + 60 * 60 * 1000).toISOString(),
          };
          if (confirmedPublished) cycle.published.push(clip.id);
          else if (accepted) cycle.submitted.push(clip.id);
          else cycle.blocked.push({ clipId: clip.id, reason: 'no production-verified platform publish succeeded' });
        } catch (error) {
          clip = {
            ...clip,
            status: 'automation_failed',
            automationError: error.message,
            nextAutomationAttemptAt: new Date(now + 15 * 60 * 1000).toISOString(),
          };
          cycle.blocked.push({ clipId: clip.id, reason: error.message });
        }
        clips.push(clip);
      }

      const completedAt = new Date().toISOString();
      const updated = await store.updateCampaign(campaign.id, {
        clipPlan: { ...campaign.clipPlan, clips },
        lastAutomationCycle: { ...cycle, completedAt },
      });

      return { campaign: updated, cycle: { ...cycle, completedAt } };
    } catch (error) {
      const failedAt = new Date().toISOString();
      await store.updateCampaign(campaign.id, {
        lastAutomationCycle: { ...cycle, failedAt, error: error.message },
      });
      error.cycle = { ...cycle, failedAt };
      throw error;
    }
  }
}

export default new ClippingAutomationService();
