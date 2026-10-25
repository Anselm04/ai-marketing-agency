import express from 'express';
import store from '../utils/store.js';
import courseMediaProductionService from '../services/courseMediaProductionService.js';
import courseFactoryMediaQueueService from '../services/courseFactoryMediaQueueService.js';

const router = express.Router();

function ownerId(req) {
  return req.user?.id || req.userId;
}

async function getOwnedProject(req, res) {
  const project = await store.getCampaignById(req.params.id);
  if (!project || project.kind !== 'ai-course-factory' || (project.owner || project.ownerId) !== ownerId(req)) {
    res.status(404).json({ error: 'Course Factory project not found' });
    return null;
  }
  return project;
}

router.post('/projects/:id/render-lessons', async (req, res) => {
  const project = await getOwnedProject(req, res);
  if (!project) return;
  if (project.approval?.status !== 'approved') {
    return res.status(409).json({ error: 'Course must be approved before lesson video rendering.' });
  }

  try {
    const renderPlan = courseMediaProductionService.buildRenderPlan(project);
    if (!renderPlan.lessons.length) {
      return res.status(409).json({ error: 'No approved source segments are available to render into lessons.' });
    }

    const mediaProduction = {
      status: req.body?.dryRun === true ? 'planned' : 'queued',
      renderPlan,
      jobs: [],
      renderedLessons: Array.isArray(project.mediaProduction?.renderedLessons)
        ? project.mediaProduction.renderedLessons
        : [],
      createdAt: project.mediaProduction?.createdAt || new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    if (req.body?.dryRun !== true) {
      mediaProduction.jobs = await courseFactoryMediaQueueService.enqueueProject(project, renderPlan);
    }

    const updated = await store.updateCampaign(project.id, { mediaProduction });
    return res.status(202).json({ project: updated, mediaProduction });
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
});

export default router;
