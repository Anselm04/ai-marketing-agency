import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateAgentResponse } from './openaiService.js';

function safeText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function slugFragment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';
}

function safeJson(value) {
  if (!value || typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : value;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeLesson(lesson = {}, moduleIndex = 0, lessonIndex = 0) {
  const safetyNotes = Array.isArray(lesson.safetyNotes)
    ? lesson.safetyNotes.map((item) => safeText(item, 600)).filter(Boolean).slice(0, 12)
    : [];
  const sourceEvidence = Array.isArray(lesson.sourceEvidence)
    ? lesson.sourceEvidence.map((item) => ({
        timestampSeconds: Math.max(0, Number(item?.timestampSeconds) || 0),
        note: safeText(item?.note || item, 800),
        kind: ['creator_evidence', 'creator_visual_evidence', 'ai_inference'].includes(item?.kind)
          ? item.kind
          : 'creator_evidence',
      })).filter((item) => item.note).slice(0, 30)
    : [];

  const incomingKind = lesson?.provenance?.kind || 'ai_generated';
  const reviewRequired = incomingKind !== 'creator_evidence' || safetyNotes.length > 0;

  return {
    id: safeText(lesson.id, 100) || `lesson-${moduleIndex + 1}-${lessonIndex + 1}`,
    title: safeText(lesson.title, 160) || `Lesson ${lessonIndex + 1}`,
    summary: safeText(lesson.summary, 1800),
    learningObjectives: Array.isArray(lesson.learningObjectives)
      ? lesson.learningObjectives.map((item) => safeText(item, 500)).filter(Boolean).slice(0, 12)
      : [],
    explanationBeginner: safeText(lesson.explanationBeginner, 5000),
    explanationAdvanced: safeText(lesson.explanationAdvanced, 5000),
    toolsAndMaterials: Array.isArray(lesson.toolsAndMaterials)
      ? lesson.toolsAndMaterials.map((item) => safeText(item, 500)).filter(Boolean).slice(0, 30)
      : [],
    safetyNotes,
    sourceEvidence,
    assignment: safeText(lesson.assignment, 2000),
    quiz: Array.isArray(lesson.quiz)
      ? lesson.quiz.slice(0, 10).map((question, index) => ({
          id: safeText(question?.id, 100) || `q-${moduleIndex + 1}-${lessonIndex + 1}-${index + 1}`,
          question: safeText(question?.question, 1000),
          options: Array.isArray(question?.options)
            ? question.options.map((item) => safeText(item, 500)).filter(Boolean).slice(0, 6)
            : [],
          answer: safeText(question?.answer, 500),
          explanation: safeText(question?.explanation, 1200),
        })).filter((question) => question.question)
      : [],
    provenance: {
      kind: incomingKind,
      reviewRequired,
    },
  };
}

function normalizeModule(module = {}, moduleIndex = 0) {
  const lessons = Array.isArray(module.lessons) ? module.lessons : [];
  return {
    id: safeText(module.id, 100) || `module-${moduleIndex + 1}`,
    title: safeText(module.title, 160) || `Module ${moduleIndex + 1}`,
    outcome: safeText(module.outcome, 1200),
    lessons: lessons.slice(0, 24).map((lesson, lessonIndex) => normalizeLesson(lesson, moduleIndex, lessonIndex)),
  };
}

function fallbackModules(input = {}) {
  const transcript = safeText(input.transcript, 16000);
  const evidenceNote = transcript
    ? transcript.split('\n').find(Boolean)?.slice(0, 800)
    : 'Source footage will be reviewed and mapped to this lesson during production.';

  const stages = [
    ['Introduction & Finished Project', 'Understand the finished result, course path, and what success looks like.'],
    ['Materials & Preparation', 'Select suitable materials and prepare the workspace before starting.'],
    ['Tools & Safety', 'Use the required tools with deliberate safety checks and correct setup.'],
    ['Design & Planning', 'Translate the desired result into a workable plan before removing material.'],
    ['Rough Work / Foundation', 'Establish the major form efficiently while preserving room for refinement.'],
    ['Fine Technique & Control', 'Refine details, transitions, accuracy, and surface quality.'],
    ['Finishing & Quality Control', 'Finish, inspect, correct defects, and prepare the final result.'],
    ['Advanced Mastery', 'Understand expert judgement, problem solving, and quality decisions demonstrated in the source footage.'],
  ];

  return stages.map(([title, outcome], moduleIndex) => ({
    id: `module-${moduleIndex + 1}`,
    title,
    outcome,
    lessons: [normalizeLesson({
      title,
      summary: outcome,
      learningObjectives: [outcome],
      explanationBeginner: `This lesson introduces ${title.toLowerCase()} in clear, beginner-friendly language. The creator's actual footage and commentary remain the primary teaching evidence.`,
      explanationAdvanced: `Advanced learners should compare the creator's sequence, tool choices, timing, and quality checks against their own workflow and identify where judgement changes the result.`,
      toolsAndMaterials: [],
      safetyNotes: title.includes('Safety') ? ['Review tool-specific PPE, dust, ventilation, securing, and handling requirements before publishing this lesson.'] : [],
      sourceEvidence: [{ timestampSeconds: 0, note: evidenceNote, kind: 'creator_evidence' }],
      assignment: `Apply the technique from ${title} to the current project and record what changed in your result.`,
      quiz: [{
        question: `What is the main purpose of ${title}?`,
        options: [outcome, 'Skip the demonstrated process', 'Replace creator evidence with guesses'],
        answer: outcome,
        explanation: outcome,
      }],
      provenance: { kind: 'ai_generated' },
    }, moduleIndex, 0)],
  }));
}

export function buildCourseProjectKey(ownerId, projectId, originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase().slice(0, 12);
  const base = slugFragment(path.basename(String(originalName || 'source-video'), ext));
  return `course-factory/${slugFragment(ownerId)}/${slugFragment(projectId)}/${Date.now()}-${randomUUID()}-${base}${ext}`;
}

export function validateMultipartParts(parts = []) {
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('At least one uploaded part is required.');
  const normalized = parts.map((part) => {
    const PartNumber = Number(part?.partNumber ?? part?.PartNumber);
    const ETag = safeText(part?.etag ?? part?.ETag, 500).replace(/^"|"$/g, '');
    if (!Number.isInteger(PartNumber) || PartNumber < 1 || PartNumber > 10000) {
      throw new Error('Each multipart part requires a valid part number between 1 and 10000.');
    }
    if (!ETag) throw new Error('Each multipart part requires an ETag.');
    return { PartNumber, ETag };
  });

  const seen = new Set();
  for (const part of normalized) {
    if (seen.has(part.PartNumber)) throw new Error(`Duplicate multipart part number: ${part.PartNumber}`);
    seen.add(part.PartNumber);
  }
  return normalized.sort((a, b) => a.PartNumber - b.PartNumber);
}

// Kept as an explicit development/test helper only. Production generation methods below never use it.
export function buildFallbackCoursePackage(input = {}) {
  const title = safeText(input.name || input.title, 180) || 'Professional Course';
  const modules = fallbackModules(input);
  const audience = safeText(input.targetAudience, 1200) || 'Learners who want a structured path from fundamentals to confident practical application.';
  const outcome = safeText(input.desiredOutcome, 1600) || 'Complete the demonstrated project safely, understand the major decisions, and repeat the workflow independently.';

  return normalizeCoursePackage({
    title,
    subtitle: outcome,
    audience,
    outcome,
    modules,
    assets: {
      manual: {
        title: `${title} — Printable Course Manual`,
        sections: modules.map((module) => ({ title: module.title, summary: module.outcome })),
      },
      worksheets: modules.map((module, index) => ({
        id: `worksheet-${index + 1}`,
        title: `${module.title} Practice Sheet`,
        prompts: ['What did you observe?', 'What technique will you practise?', 'What changed in the result?', 'What needs correction before moving on?'],
      })),
      youtube: {
        title,
        description: `${outcome}\n\nThis course is structured from real creator footage and reviewed teaching material.`,
        chapters: modules.map((module, index) => ({ title: module.title, order: index + 1 })),
      },
      skool: {
        courseTitle: title,
        about: outcome,
        modules: modules.map((module) => ({ title: module.title, lessonTitles: module.lessons.map((lesson) => lesson.title) })),
      },
      shortForm: modules.slice(0, 8).map((module, index) => ({
        id: `short-${index + 1}`,
        title: `${module.title}: one key lesson`,
        hook: `One thing most beginners miss about ${module.title.toLowerCase()}.`,
        sourceModuleId: module.id,
        platforms: ['YouTube Shorts', 'Instagram Reels', 'TikTok', 'Facebook Reels'],
      })),
      marketing: {
        landingPage: {
          headline: `Learn ${title} from real expert process`,
          subheadline: outcome,
          bullets: modules.slice(0, 6).map((module) => module.outcome),
        },
        emailSequence: [
          { subject: `Welcome to ${title}`, purpose: 'Introduce the course outcome and first action.' },
          { subject: 'The biggest mistake to avoid', purpose: 'Teach one useful lesson and bring the learner back to the course.' },
          { subject: 'Put the technique into practice', purpose: 'Prompt a practical assignment and community participation.' },
          { subject: 'Finish your project', purpose: 'Encourage completion and show the next step.' },
        ],
        socialPosts: modules.slice(0, 6).map((module) => ({ hook: module.title, body: module.outcome })),
      },
    },
    provenance: {
      creatorEvidence: Boolean(input.transcript || input.visualAnalysis),
      aiInferenceRequiresReview: true,
    },
    review: { required: true, status: 'pending' },
  }, input);
}

export function normalizeCoursePackage(raw = {}, input = {}) {
  const modules = Array.isArray(raw.modules) && raw.modules.length
    ? raw.modules.slice(0, 30).map((module, index) => normalizeModule(module, index))
    : fallbackModules(input);

  const hasReviewableLesson = modules.some((module) => module.lessons.some((lesson) => lesson.provenance.reviewRequired));
  const assets = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};

  return {
    title: safeText(raw.title || input.name, 180) || 'Professional Course',
    subtitle: safeText(raw.subtitle || raw.outcome || input.desiredOutcome, 1800),
    audience: safeText(raw.audience || input.targetAudience, 1600),
    outcome: safeText(raw.outcome || input.desiredOutcome, 1800),
    modules,
    assets: {
      manual: {
        title: safeText(assets.manual?.title, 220) || `${safeText(raw.title || input.name, 180) || 'Professional Course'} — Printable Course Manual`,
        sections: Array.isArray(assets.manual?.sections)
          ? assets.manual.sections.slice(0, 100)
          : modules.map((module) => ({ title: module.title, summary: module.outcome })),
      },
      worksheets: Array.isArray(assets.worksheets) ? assets.worksheets.slice(0, 100) : [],
      youtube: assets.youtube || {},
      skool: assets.skool || {},
      shortForm: Array.isArray(assets.shortForm) ? assets.shortForm.slice(0, 100) : [],
      marketing: {
        landingPage: assets.marketing?.landingPage || {},
        emailSequence: Array.isArray(assets.marketing?.emailSequence) ? assets.marketing.emailSequence.slice(0, 20) : [],
        socialPosts: Array.isArray(assets.marketing?.socialPosts) ? assets.marketing.socialPosts.slice(0, 50) : [],
      },
    },
    provenance: {
      creatorEvidence: raw.provenance?.creatorEvidence === true || Boolean(input.transcript || input.visualAnalysis),
      aiInferenceRequiresReview: true,
    },
    review: {
      required: true,
      status: raw.review?.status === 'approved' && !hasReviewableLesson ? 'approved' : 'pending',
    },
    generatedAt: new Date().toISOString(),
  };
}

function generationError(message, cause = null) {
  const error = new Error(message);
  error.code = 'course_ai_generation_failed';
  error.statusCode = 503;
  if (cause) error.cause = cause;
  return error;
}

async function generateWithAI(input = {}) {
  const transcript = safeText(input.transcript, 24000);
  const visualObservations = Array.isArray(input.visualAnalysis?.observations)
    ? input.visualAnalysis.observations.slice(0, 80).map((item) => ({
        timestampSeconds: Number(item.timestampSeconds) || 0,
        observation: safeText(item.observation, 800),
        provenance: item.provenance,
      }))
    : [];

  const prompt = [
    'Create a professional online course package from real creator source evidence.',
    'Return JSON only.',
    'Do not invent creator quotes, tool choices, safety facts, or demonstrated steps that are not supported by source evidence.',
    'Any inferred teaching must use provenance.kind="ai_generated" or "ai_inference" and remain reviewRequired=true.',
    'Creator transcript evidence may use provenance.kind="creator_evidence".',
    'Include 6-12 modules, lessons, beginner and advanced explanations, learning objectives, tools/materials, safety notes, assignments, quizzes, a printable manual outline, worksheets, YouTube metadata, Skool module packaging, short-form derivative ideas, landing-page copy, social posts, and a 4-email sequence.',
    `Course title: ${safeText(input.name, 300)}`,
    `Audience: ${safeText(input.targetAudience, 1200)}`,
    `Desired outcome: ${safeText(input.desiredOutcome, 1600)}`,
    `Skill level: ${safeText(input.skillLevel, 200)}`,
    `Creator transcript: ${transcript || '[No spoken transcript; rely on visual evidence and mark inferences for review.]'}`,
    `Visual observations: ${JSON.stringify(visualObservations).slice(0, 16000)}`,
  ].join('\n');

  let ai;
  try {
    ai = await generateAgentResponse('content-writer', prompt, {
      userId: input.owner || input.ownerId,
      courseFactory: true,
      projectName: input.name,
    });
  } catch (error) {
    throw generationError('Professional course generation failed. No fallback course was substituted.', error);
  }

  if (ai?.fallback === true) {
    throw generationError('Professional course generation is unavailable because the configured AI provider did not complete the request. No fallback course was substituted.');
  }

  const parsed = safeJson(ai?.content);
  if (!parsed) {
    throw generationError('The AI provider returned an invalid course package. No fallback course was substituted.');
  }

  const normalized = normalizeCoursePackage(parsed, input);
  if (!normalized.modules.length) {
    throw generationError('The AI provider returned an empty course package. No fallback course was substituted.');
  }
  return normalized;
}

class CourseFactoryService {
  async generateCurriculum(input = {}) {
    const packageData = await generateWithAI(input);
    return {
      generatedAt: packageData.generatedAt,
      title: packageData.title,
      subtitle: packageData.subtitle,
      audience: packageData.audience,
      outcome: packageData.outcome,
      modules: packageData.modules,
      provenance: packageData.provenance,
      review: packageData.review,
      aiFallback: false,
    };
  }

  async generatePackage(input = {}) {
    return generateWithAI(input);
  }
}

export default new CourseFactoryService();
