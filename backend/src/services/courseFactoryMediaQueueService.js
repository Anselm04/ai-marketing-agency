import store from '../utils/store.js';
import { addJob, registerWorker } from '../utils/queue.js';
import courseMediaProductionService from './courseMediaProductionService.js';

const QUEUE_NAME = 'course-factory-media';

async function processRenderJob(job) {
  const { projectId, ownerId, lessonPlan } = job.data || {};
  const project = await store.getCampaignById(projectId);
  if (!project || project.kind !== 'ai-course-factory') throw new Error('Course Factory project not found');
  if ((project.owner || project.ownerId) !== ownerId) throw new Error('Course Factory project ownership mismatch');
  if (project.approval?.status !== 'approved') throw new Error('Course must remain approved while lesson rendering runs');

  const rendered = await courseMediaProductionService.renderLesson({ project, lessonPlan, ownerId });
  const fresh = await store.getCampaignById(projectId);
  const current = Array.isArray(fresh?.mediaProduction?.renderedLessons)
    ? fresh.mediaProduction.renderedLessons
    : [];
  const next = [...current.filter((item) => item.lessonId !== rendered.lessonId), rendered];
  const total = Number(fresh?.mediaProduction?.renderPlan?.lessons?.length) || next.length;
  const status = next.filter((item) => ['ready', 'rendered', 'rendered_local'].includes(item.status)).length >= total
    ? 'complete'
    : 'rendering';

  await store.updateCampaign(projectId, {
    mediaProduction: {
      ...(fresh.mediaProduction || {}),
      renderedLessons: next,
      status,
      lastUpdatedAt: new Date().toISOString(),
    },
  });
  return rendered;
}

registerWorker(QUEUE_NAME, processRenderJob, { concurrency: 1 });

class CourseFactoryMediaQueueService {
  async enqueueProject(project, renderPlan) {
    const ownerId = project.owner || project.ownerId;
    const jobs = [];
    for (const lessonPlan of renderPlan.lessons) {
      const job = await addJob(QUEUE_NAME, 'render-course-lesson', {
        projectId: project.id,
        ownerId,
        lessonPlan,
      }, {
        jobId: `${project.id}:${lessonPlan.id}`,
        attempts: 3,
      });
      jobs.push({ id: String(job.id), lessonId: lessonPlan.id, status: job.status || 'queued' });
    }
    return jobs;
  }
}

export { QUEUE_NAME };
export default new CourseFactoryMediaQueueService();
