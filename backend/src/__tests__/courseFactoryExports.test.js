import request from 'supertest';
import app from '../index.js';
import store from '../utils/store.js';

describe('Course Factory approved exports', () => {
  let token;
  let user;

  beforeAll(async () => {
    const email = `course-export-${Date.now()}@example.com`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password: 'SecurePass123!',
        firstName: 'Export',
        lastName: 'Owner',
        acceptedTerms: true,
      });
    token = register.body.token;
    user = await store.findUserByEmail(email);
    await store.createSubscription({
      userId: user.id,
      user: user.id,
      plan: 'starter',
      status: 'active',
      source: 'test',
      expiresAt: null,
    });
  });

  async function preparedProject({ approved = true } = {}) {
    const created = await request(app)
      .post('/api/course-factory/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Real Carving Course',
        rightsManifest: { confirmedOwnership: true, commercialUseAllowed: true },
      });

    const coursePackage = {
      title: 'Real Carving Course',
      subtitle: 'Learn from real source footage',
      audience: 'Carvers',
      outcome: 'Complete the demonstrated process',
      modules: [{
        id: 'module-1',
        title: 'Foundation',
        outcome: 'Prepare the work safely',
        lessons: [{
          id: 'lesson-1',
          title: 'Tool setup',
          summary: 'Prepare the tools shown in the source footage.',
          explanationBeginner: 'Start with the demonstrated setup.',
          explanationAdvanced: 'Refine the setup for control and repeatability.',
          learningObjectives: ['Prepare the demonstrated tool setup'],
          toolsAndMaterials: ['Carving tool'],
          safetyNotes: ['Use the creator-reviewed safety procedure.'],
          assignment: 'Prepare your own setup and compare it with the source evidence.',
          quiz: [{ question: 'What is the first step?', options: ['Prepare tools', 'Skip setup'], answer: 'Prepare tools', explanation: 'Preparation comes first.' }],
          sourceEvidence: [{ timestampSeconds: 12, note: 'Creator prepares the tool.', kind: 'creator_evidence' }],
          provenance: { kind: 'creator_evidence', reviewRequired: false },
        }],
      }],
      assets: {
        manual: { title: 'Real Carving Course — Manual', sections: [{ title: 'Foundation', summary: 'Prepare the work safely' }] },
        worksheets: [{ title: 'Setup worksheet', prompts: ['List your tools'] }],
        youtube: { title: 'Real Carving Course', description: 'Course overview' },
        skool: { courseTitle: 'Real Carving Course', modules: [{ title: 'Foundation', lessonTitles: ['Tool setup'] }] },
        shortForm: [{ title: 'Tool setup tip', hook: 'Prepare first' }],
        marketing: { landingPage: { headline: 'Learn the real process' }, emailSequence: [], socialPosts: [] },
      },
      review: { required: true, status: 'pending' },
      provenance: { creatorEvidence: true, aiInferenceRequiresReview: true },
    };

    return store.updateCampaign(created.body.id, {
      transcript: '[12.00s] Creator prepares the tool.',
      coursePackage,
      approval: {
        humanApprovalRequired: true,
        status: approved ? 'approved' : 'pending',
        approvedAt: approved ? new Date().toISOString() : null,
        approvedBy: approved ? user.id : null,
        notes: '',
      },
      status: approved ? 'approved' : 'package_ready',
    });
  }

  test('blocks export until the creator approves the package', async () => {
    const project = await preparedProject({ approved: false });
    const response = await request(app)
      .get(`/api/course-factory/projects/${project.id}/exports/bundle-json`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('course_approval_required');
  });

  test('downloads an approved evidence-backed JSON bundle', async () => {
    const project = await preparedProject();
    const response = await request(app)
      .get(`/api/course-factory/projects/${project.id}/exports/bundle-json`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/attachment/);
    expect(response.body.course.title).toBe('Real Carving Course');
    expect(response.body.course.modules[0].lessons[0].sourceEvidence[0].kind).toBe('creator_evidence');
    expect(response.body.exportedAt).toBeDefined();
  });

  test('downloads a printable markdown manual from the approved package', async () => {
    const project = await preparedProject();
    const response = await request(app)
      .get(`/api/course-factory/projects/${project.id}/exports/manual-markdown`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/markdown/);
    expect(response.headers['content-disposition']).toMatch(/\.md/);
    expect(response.text).toMatch(/# Real Carving Course/);
    expect(response.text).toMatch(/## Foundation/);
    expect(response.text).toMatch(/### Tool setup/);
    expect(response.text).toMatch(/Creator prepares the tool/);
  });
});