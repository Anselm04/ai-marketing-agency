import store from '../utils/store.js';
import { getUserPlanContext } from './planQuotaService.js';
import { withEcosystemLock } from './ecosystemLock.js';

const GIB = 1024 ** 3;
const ACTIVE_UPLOAD_STATES = new Set(['uploading', 'complete']);

function quotaError(message, code, statusCode = 409, extra = {}) {
  return Object.assign(new Error(message), { code, statusCode, status: statusCode, ...extra });
}

function configuredLimitBytes(plan) {
  const planKey = `COURSE_FACTORY_STORAGE_GIB_${String(plan || 'starter').toUpperCase()}`;
  const raw = process.env[planKey] ?? process.env.COURSE_FACTORY_STORAGE_GIB_DEFAULT;

  if (raw == null || String(raw).trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw quotaError(
        'Course Factory account storage limits are not configured for production.',
        'course_factory_storage_quota_not_configured',
        503,
        { plan, configurationKey: planKey },
      );
    }
    return Infinity;
  }

  const gib = Number(raw);
  if (!Number.isFinite(gib) || gib <= 0) {
    throw quotaError(
      'Course Factory account storage limit configuration is invalid.',
      'course_factory_storage_quota_invalid',
      503,
      { plan, configurationKey: planKey },
    );
  }
  return Math.floor(gib * GIB);
}

export function projectReservedUploadBytes(project = {}) {
  const upload = project.upload;
  if (!upload || !ACTIVE_UPLOAD_STATES.has(String(upload.status || ''))) return 0;
  const size = Number(upload.size);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

export async function courseFactoryStorageStatus(userId) {
  const context = await getUserPlanContext(userId);
  const limitBytes = configuredLimitBytes(context.plan);
  const projects = (await store.getCampaignsByOwner(userId))
    .filter((campaign) => campaign.kind === 'ai-course-factory');
  const usedBytes = projects.reduce((sum, project) => sum + projectReservedUploadBytes(project), 0);
  return {
    plan: context.plan,
    limitBytes,
    usedBytes,
    remainingBytes: limitBytes === Infinity ? Infinity : Math.max(0, limitBytes - usedBytes),
  };
}

export async function withCourseFactoryStorageReservation({ userId, requestedBytes, task }) {
  const size = Number(requestedBytes);
  if (!userId || !Number.isFinite(size) || size <= 0 || typeof task !== 'function') {
    throw quotaError('Invalid Course Factory storage reservation request.', 'course_factory_storage_reservation_invalid', 400);
  }

  return withEcosystemLock(`course-factory-storage:${userId}`, async () => {
    const status = await courseFactoryStorageStatus(userId);
    if (status.limitBytes !== Infinity && status.usedBytes + size > status.limitBytes) {
      throw quotaError(
        'Course Factory account storage limit would be exceeded by this upload.',
        'course_factory_storage_quota_exceeded',
        402,
        {
          plan: status.plan,
          quota: {
            usedBytes: status.usedBytes,
            requestedBytes: size,
            limitBytes: status.limitBytes,
            remainingBytes: status.remainingBytes,
          },
        },
      );
    }
    return task(status);
  });
}

export default {
  courseFactoryStorageStatus,
  projectReservedUploadBytes,
  withCourseFactoryStorageReservation,
};
