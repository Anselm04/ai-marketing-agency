# Course Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-grade long-form video to professional course pipeline inside TrillionAI Marketing.

**Architecture:** Course Factory is a dedicated domain that reuses existing authentication, campaign persistence, S3-compatible storage, FFmpeg transcription/rendering, OpenAI, clipping, and marketing infrastructure. Large uploads go directly to object storage using multipart upload; Course Factory then creates evidence-backed curricula and export-ready course packages with human approval gates.

**Tech Stack:** Node.js 22, Express, AWS SDK S3 multipart uploads, OpenAI, FFmpeg/ffprobe, Supabase/PostgreSQL via existing store, React 18, Vite, Jest/Supertest, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-course-factory.md`

## Global Constraints
- Do not proxy multi-GB production video bodies through Node.
- Creator evidence outranks AI inference.
- AI-inferred technical/safety content remains reviewable and human-gated.
- Direct Skool publishing must not be claimed unless a supported integration is present.
- Existing clipping, auth, storage and campaign behavior must remain compatible.
- Production storage requires configured S3-compatible durable storage.

## Review Focus
- Multipart uploads with missing/invalid parts must fail safely and be abortable.
- A project owned by one user must never be accessible by another user.
- Silent footage must still generate useful visual observations when visual analysis is enabled.
- Projects without confirmed rights must not start AI processing.
- AI-generated safety/technical claims must remain distinguishable from creator evidence until approval.

---

### Task 1: Course Factory API contract and ownership

**Files:**
- Create: `backend/src/__tests__/courseFactory.test.js`
- Create: `backend/src/routes/courseFactory.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Produces: authenticated CRUD endpoints under `/api/course-factory/projects`.
- Persists projects using existing campaign store with `kind: ai-course-factory`.

- [ ] Write failing API tests for create/list/get, owner isolation, rights gating and approval state.
- [ ] Run Course Factory tests and confirm missing route failures.
- [ ] Implement routes and route registration.
- [ ] Run focused tests, then backend suite.
- [ ] Commit.

### Task 2: Multi-GB direct multipart uploads

**Files:**
- Modify: `backend/src/services/uploadService.js`
- Modify: `backend/src/routes/courseFactory.js`
- Extend: `backend/src/__tests__/courseFactory.test.js`

**Interfaces:**
- Produces: create-upload, sign-part, complete-upload and abort-upload endpoints.
- Returns durable object key/source URL metadata for later processing.

- [ ] Add failing tests for S3-required behavior, part validation and ownership-bound object keys.
- [ ] Implement S3 multipart primitives with `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`, `AbortMultipartUpload`.
- [ ] Expose presigned part URLs; browser uploads bytes directly to storage.
- [ ] Run focused tests and backend suite.
- [ ] Commit.

### Task 3: Evidence-backed course generation

**Files:**
- Create: `backend/src/services/courseFactoryService.js`
- Modify: `backend/src/routes/courseFactory.js`
- Extend: `backend/src/__tests__/courseFactory.test.js`

**Interfaces:**
- Consumes: source URL, transcript, audience, outcome, skill level, rights manifest.
- Produces: curriculum, modules, lessons, provenance tags, quizzes, worksheets, assignments, manual outline, YouTube metadata and derivative-content plan.

- [ ] Add failing tests for deterministic fallback package structure, provenance tags and human-review flags.
- [ ] Implement course package schema and generation service with OpenAI when configured and safe deterministic fallback for tests.
- [ ] Add `/transcribe`, `/generate-curriculum`, `/generate-package`, `/approve` endpoints.
- [ ] Reuse `mediaClipperService.transcribeSource` for long-form transcript generation.
- [ ] Run focused tests and backend suite.
- [ ] Commit.

### Task 4: Visual analysis for silent demonstrations

**Files:**
- Create: `backend/src/services/courseVisualAnalysisService.js`
- Modify: `backend/src/routes/courseFactory.js`
- Extend: `backend/src/__tests__/courseFactory.test.js`

**Interfaces:**
- Consumes: approved HTTP(S) source URL.
- Produces: timestamped `creator_visual_evidence` / `ai_inference` observations and scene-stage candidates.

- [ ] Add failing tests for bounded sampling config and provenance shape.
- [ ] Implement ffmpeg frame extraction with configurable sampling and multimodal analysis when configured.
- [ ] Add `/analyse-visuals` endpoint and persist observations.
- [ ] Ensure analysis cannot publish inferred claims automatically.
- [ ] Run focused tests and backend suite.
- [ ] Commit.

### Task 5: Course Factory frontend

**Files:**
- Create: `frontend/src/pages/CourseFactory.jsx`
- Create: `frontend/src/pages/CourseFactory.test.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout.jsx`

**Interfaces:**
- Consumes: `/api/course-factory/*` endpoints.
- Produces: project creation, rights confirmation, multipart upload, processing controls, curriculum/package review and approval UI.

- [ ] Write failing UI test for Course Factory navigation/rendering and rights controls.
- [ ] Implement page and navigation route.
- [ ] Add browser multipart upload helper with progress.
- [ ] Add curriculum/package review and approval actions.
- [ ] Run frontend tests and build.
- [ ] Commit.

### Task 6: Configuration, evidence and release verification

**Files:**
- Modify: `backend/.env.example`
- Create: `docs/course-factory-operations.md`

**Interfaces:**
- Documents runtime requirements without exposing secrets or proprietary strategy.

- [ ] Add configuration for max source duration, part size, visual sampling, analysis models and processing timeouts.
- [ ] Document FFmpeg + durable storage requirements and failure behavior.
- [ ] Run full repository tests and frontend build.
- [ ] Review branch diff for security, ownership isolation, unsupported claims and regression risk.
- [ ] Open PR; do not merge until checks are green.
