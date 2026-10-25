# Course Factory Operations

Course Factory turns creator-owned long-form video into reviewable course structure and supporting educational/marketing assets.

## Runtime requirements

- Node.js 22+
- FFmpeg and ffprobe available on the backend worker image
- PostgreSQL/Supabase production persistence
- S3-compatible durable object storage with browser CORS configured for multipart PUT and `ETag` exposed to the browser
- `S3_PUBLIC_BASE_URL` (or an equivalent HTTP-readable source URL) so backend media workers can read completed source objects
- OpenAI credentials for transcription and sampled visual analysis

## Long-video ingest

Large source files must use the Course Factory multipart workflow. The browser uploads each part directly to object storage using short-lived signed URLs; the Node API never proxies the full multi-gigabyte body.

Default part size is 64 MiB. The default maximum source object is 500 GiB and can be reduced through configuration. Multipart uploads are owner/project scoped and can be explicitly aborted when a client upload fails.

For browser uploads, storage CORS must permit the application origin to `PUT` objects and must expose the `ETag` response header. Course Factory needs each part ETag to complete the multipart upload.

## Long-form processing

Transcription reuses the existing FFmpeg + chunked transcription primitive. Configure `CLIPPING_MAX_SOURCE_SECONDS` for the longest single Course Factory source you intend to process; the repository example uses 43,200 seconds (12 hours). Multiple projects/sources should be used rather than making processing unbounded.

Silent demonstrations are supported by sampled visual analysis. Frames are deliberately sampled rather than sending every frame to a vision model. Observations are stored as `ai_inference` with `reviewRequired: true`.

## Course outputs

The generated package can contain:

- structured modules and lessons
- beginner and advanced explanations
- source-evidence references
- tool/material fields
- safety-review fields
- quizzes and answer explanations
- assignments
- printable-manual content structure
- worksheets
- YouTube title/description/chapter metadata
- Skool-ready course/module/lesson structure
- short-form derivative ideas
- landing-page copy
- social-post ideas
- email sequence

Skool-ready means the package is structured for review/import. The product must not claim direct Skool publishing unless a supported authenticated integration is added and verified.

## Human approval

Course Factory defaults every project to human approval required. Machine visual interpretations and AI-generated technical/safety material remain review-required. Approval is an explicit project action and should occur only after the creator has checked that the generated teaching accurately represents their expertise and source footage.

## Production truth rules

- Never present a generated asset as published unless the destination provider confirms publication.
- Never convert AI visual inference into creator-authored fact without creator review.
- Never process third-party footage commercially without confirmed ownership/permission.
- Never expose private source objects through an unrestricted bucket solely to make processing easier; use an approved delivery/storage architecture appropriate to the deployment.

## Current integration boundary

Course Factory reuses the Marketing Agency's existing clipping and marketing foundations, but its course-package generation is intentionally separate from short-form clipping. Further rendering/publishing adapters should consume the approved Course Factory package rather than bypassing its provenance and approval controls.
