# Course Factory Design

## Intent
Add a production-grade Course Factory to TrillionAI Marketing that turns long-form creator video into a structured, professional course package and downstream marketing assets without forcing the creator to stop and teach to camera while recording.

## Goals
- Accept multi-GB long-form video through direct multipart object-storage uploads.
- Preserve creator ownership/rights metadata and require rights confirmation before AI processing/publishing.
- Transcribe long footage in chunks and analyse sampled visual frames so silent demonstrations remain useful.
- Build a curriculum from creator evidence first, then generate lesson explanations, safety notes, tool/material lists, quizzes, worksheets, assignments, downloadable manual copy, YouTube metadata, Shorts/Reels plans, and Skool-ready lesson packaging.
- Require human approval before publishing or presenting inferred AI teaching as creator-authored fact.
- Reuse existing clipping, storage, AI, campaign, authentication, and marketing infrastructure.
- Make the workflow subject-neutral: carving, cooking, automotive, coding, art, fitness, business, etc.

## Non-goals
- Do not claim automatic direct Skool publishing unless a supported integration exists.
- Do not fabricate creator knowledge or silently convert AI guesses into factual teaching.
- Do not make Node proxy multi-GB file bodies in production.
- Do not replace the existing clipping agency; Course Factory should feed it.

## Architecture
Course Factory projects are stored as campaign records with `kind: ai-course-factory`, following the existing clipping model and avoiding a new persistence layer. Large video uploads use S3-compatible multipart upload sessions directly from the browser. Processing is broken into explicit stages: ingest, transcription, visual analysis, curriculum generation, course-package generation, approval, and derivatives.

`mediaClipperService` remains the trusted FFmpeg/transcription primitive. A new `courseFactoryService` owns curriculum/course-package generation and provenance rules. A new `courseFactory` route exposes project lifecycle APIs. A dedicated React page gives creators a simple project dashboard and explicit approval controls.

## Data model
A Course Factory campaign contains:
- source metadata and multipart-upload result
- audience/outcome/skill-level configuration
- rights manifest
- transcript + transcription provenance
- visual observations + source timestamps
- curriculum/modules/lessons
- generated assets manifest
- approval state and reviewer notes
- derivative clipping campaign link(s)
- processing status and errors

## Safety / truth controls
- Rights ownership and commercial-use confirmation are mandatory before processing/publishing.
- AI-generated visual interpretations are tagged `ai_inference` until approved.
- Creator transcript evidence is tagged `creator_evidence`.
- Generated safety guidance must be tagged and reviewable before publication.
- Publishing remains human-gated by default.

## Upload strategy
Use S3 multipart uploads for long videos. Default part size: 64 MiB. Maximum source duration is configurable and defaults to 12 hours per source file; users can upload multiple source files for larger projects. This supports practical multi-hour 4K footage while keeping processing bounded.

## User experience
Dashboard navigation adds `Course Factory`.

Creator flow:
1. Create project.
2. Confirm rights and target audience/outcome.
3. Upload long-form source video directly to object storage.
4. Start analysis.
5. Review generated curriculum.
6. Generate full course package.
7. Approve or revise inferred teaching/safety content.
8. Export Skool-ready package and optionally create short-form marketing derivatives.

## Approaches considered
1. Extend the existing AI Clipping Agency only. Rejected because course production has different lifecycle, provenance, curriculum, and approval semantics.
2. Build a separate standalone service. Rejected for now because storage, authentication, AI, campaigns, FFmpeg and marketing infrastructure already exist in this app.
3. Add a dedicated Course Factory domain inside the existing app while reusing shared media/marketing services. Selected because it provides clean product boundaries with minimal duplicated infrastructure.
