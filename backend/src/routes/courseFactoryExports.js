import express from 'express';
import store from '../utils/store.js';
import { courseRightsError } from '../services/courseRightsService.js';

const router = express.Router();

function ownerId(req) {
  return req.user?.id || req.userId;
}

function filenamePart(value) {
  return String(value || 'course')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'course';
}

async function getApprovedProject(req, res) {
  const project = await store.getCampaignById(req.params.id);
  if (!project || project.kind !== 'ai-course-factory' || (project.owner || project.ownerId) !== ownerId(req)) {
    res.status(404).json({ error: 'Course Factory project not found' });
    return null;
  }

  const rightsError = courseRightsError(project.rightsManifest);
  if (rightsError) {
    res.status(409).json(rightsError);
    return null;
  }

  if (project.approval?.status !== 'approved') {
    res.status(409).json({
      error: 'Course export is blocked until the creator approves the generated course.',
      code: 'course_approval_required',
    });
    return null;
  }

  if (!project.coursePackage) {
    res.status(409).json({
      error: 'Generate the professional course package before exporting it.',
      code: 'course_package_required',
    });
    return null;
  }

  return project;
}

function lessonQuizBank(course) {
  const rows = [];
  for (const module of course.modules || []) {
    for (const lesson of module.lessons || []) {
      for (const question of lesson.quiz || []) {
        rows.push({
          moduleId: module.id || null,
          moduleTitle: module.title || '',
          lessonId: lesson.id || null,
          lessonTitle: lesson.title || '',
          ...question,
        });
      }
    }
  }
  return rows;
}

function manualMarkdown(course) {
  const lines = [
    `# ${course.title || 'Course Manual'}`,
    '',
  ];

  if (course.subtitle) lines.push(course.subtitle, '');
  if (course.audience) lines.push(`**Audience:** ${course.audience}`, '');
  if (course.outcome) lines.push(`**Outcome:** ${course.outcome}`, '');

  for (const module of course.modules || []) {
    lines.push(`## ${module.title || 'Module'}`, '');
    if (module.outcome) lines.push(module.outcome, '');

    for (const lesson of module.lessons || []) {
      lines.push(`### ${lesson.title || 'Lesson'}`, '');
      if (lesson.summary) lines.push(lesson.summary, '');

      if (lesson.learningObjectives?.length) {
        lines.push('#### Learning objectives', '');
        for (const item of lesson.learningObjectives) lines.push(`- ${item}`);
        lines.push('');
      }

      if (lesson.explanationBeginner) {
        lines.push('#### Beginner explanation', '', lesson.explanationBeginner, '');
      }
      if (lesson.explanationAdvanced) {
        lines.push('#### Advanced explanation', '', lesson.explanationAdvanced, '');
      }

      if (lesson.toolsAndMaterials?.length) {
        lines.push('#### Tools and materials', '');
        for (const item of lesson.toolsAndMaterials) lines.push(`- ${item}`);
        lines.push('');
      }

      if (lesson.safetyNotes?.length) {
        lines.push('#### Creator-reviewed safety notes', '');
        for (const item of lesson.safetyNotes) lines.push(`- ${item}`);
        lines.push('');
      }

      if (lesson.assignment) lines.push('#### Assignment', '', lesson.assignment, '');

      if (lesson.sourceEvidence?.length) {
        lines.push('#### Source evidence', '');
        for (const item of lesson.sourceEvidence) {
          const time = Number(item.timestampSeconds);
          const stamp = Number.isFinite(time) ? `${time.toFixed(2)}s` : 'source';
          lines.push(`- **${stamp}** — ${item.note || ''} (${item.kind || 'evidence'})`);
        }
        lines.push('');
      }

      if (lesson.quiz?.length) {
        lines.push('#### Knowledge check', '');
        lesson.quiz.forEach((question, index) => {
          lines.push(`${index + 1}. ${question.question || ''}`);
          for (const option of question.options || []) lines.push(`   - ${option}`);
          if (question.answer) lines.push(`   - **Answer:** ${question.answer}`);
          if (question.explanation) lines.push(`   - **Why:** ${question.explanation}`);
        });
        lines.push('');
      }
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

function bundle(project) {
  const course = project.coursePackage;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      approvedAt: project.approval?.approvedAt || null,
      approvedBy: project.approval?.approvedBy || null,
      rightsManifest: project.rightsManifest,
    },
    course,
    exports: {
      skool: course.assets?.skool || {},
      youtube: course.assets?.youtube || {},
      worksheets: course.assets?.worksheets || [],
      quizBank: lessonQuizBank(course),
      marketingKit: course.assets?.marketing || {},
      shortFormPlan: course.assets?.shortForm || [],
    },
  };
}

router.get('/projects/:id/exports/:format', async (req, res) => {
  const project = await getApprovedProject(req, res);
  if (!project) return;

  const course = project.coursePackage;
  const base = filenamePart(course.title || project.name);
  const format = String(req.params.format || '').toLowerCase();

  if (format === 'manual-markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}-manual.md"`);
    return res.send(manualMarkdown(course));
  }

  const exports = {
    'bundle-json': bundle(project),
    'skool-json': course.assets?.skool || {},
    'youtube-json': course.assets?.youtube || {},
    'worksheets-json': course.assets?.worksheets || [],
    'quiz-bank-json': lessonQuizBank(course),
    'marketing-kit-json': course.assets?.marketing || {},
    'short-form-json': course.assets?.shortForm || [],
  };

  if (!Object.prototype.hasOwnProperty.call(exports, format)) {
    return res.status(404).json({
      error: 'Unknown Course Factory export format.',
      code: 'course_export_format_not_found',
      availableFormats: ['bundle-json', 'manual-markdown', ...Object.keys(exports).filter((key) => key !== 'bundle-json')],
    });
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}-${format.replace(/-json$/, '')}.json"`);
  return res.send(JSON.stringify(exports[format], null, 2));
});

export { bundle, lessonQuizBank, manualMarkdown };
export default router;