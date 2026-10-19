# AI Marketing Agency Release Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a real, independently isolated release foundation for the AI Marketing Agency across GitHub, Vercel, and Fly, with deterministic local/CI validation and no AppForge production dependencies.

**Architecture:** Keep `Anselm04/ai-marketing-agency` as the only source repository for this product. Link a dedicated Vercel project to this repository for the Vite frontend, keep the Node backend in the dedicated Fly app `trillionai-marketing`, and route `/api/*` only to the verified Marketing Agency Fly origin. GitHub Actions remains the release gate and must execute successfully rather than merely exist as YAML.

**Tech Stack:** GitHub Actions, Node.js 22, npm workspaces, React/Vite, Vercel, Fly.io, Docker.

**Spec:** `docs/superpowers/specs/2026-10-20-marketing-platform-isolation-design.md`

## Global Constraints

- Shared provider account → separate app-specific projects/resources.
- Do not reuse AppForge project IDs, secrets, databases, queues, Stripe objects, OAuth credentials, deployment targets, domains, or runtime state.
- Work only on `fix/vercel-production-routing` until this slice is finished or explicitly abandoned.
- No force merge and no PR backlog.
- Do not merge unless executable qualification actually runs.
- External/account blockers must remain labeled blocked/unverified rather than replaced with fake success.
- Do not provision nonzero-cost resources without explicit confirmation when the provider reports a charge.
- Do not use Sprites for work direct provider/GitHub tools can perform.

## Review Focus

- Wrong-provider isolation: Vercel/Fly settings must reference only Marketing Agency resources.
- Monorepo build drift: Vercel and CI must use the same Node/npm/workspace assumptions as the repository.
- SPA/API routing conflict: `/api/*` must never fall through to `index.html`, while application routes must.
- Backend origin mismatch: the configured Fly API hostname must be proven live before it is treated as production truth.
- False-green release state: a config file or status badge is insufficient unless the actual build/deploy job executes and reports success.

---

### Task 1: Verify release identities and current branch state

**Files:**
- Read: `vercel.json`
- Read: `fly.toml`
- Read: `.github/workflows/ci.yml`
- Read: `.github/workflows/deploy-production.yml`
- Read: `package.json`
- Read: `frontend/package.json`
- Read: `backend/package.json`

**Interfaces:**
- Consumes: approved isolation spec and branch `fix/vercel-production-routing`.
- Produces: verified repository SHA, verified Fly app identity/origin, and exact Vercel team/project state for later tasks.

- [ ] **Step 1: Re-read the exact branch versions of release-critical files and record current branch SHA.**
- [ ] **Step 2: Verify `https://trillionai-marketing.fly.dev/health` responds as the intended Marketing Agency backend and verify `/` separately.**
- [ ] **Step 3: Query the connected Vercel team and Git integration for any existing project linked to `Anselm04/ai-marketing-agency`; do not create a duplicate.**
- [ ] **Step 4: Verify current GitHub commit status for the branch and capture the failing Vercel target/deployment reference.**
- [ ] **Step 5: Commit only if repository documentation needed correction; otherwise leave code untouched.**

### Task 2: Establish the dedicated Vercel project and deterministic Vite build

**Files:**
- Modify: `vercel.json` only if required by verified Vercel project settings/build behavior.
- Test: provider preview deployment for `fix/vercel-production-routing`.

**Interfaces:**
- Consumes: verified Vercel team, Git repository, branch SHA, and Fly API origin from Task 1.
- Produces: one dedicated Vercel project linked only to `Anselm04/ai-marketing-agency`, configured for Vite and this monorepo.

- [ ] **Step 1: If no existing Vercel project is linked, create/reuse exactly one dedicated project under the connected team using the Git repository link.**
- [ ] **Step 2: Set/verify framework `vite`, Node `22.x`, repository-root source, build command `npm run build --workspace=frontend`, and output directory `frontend/dist`.**
- [ ] **Step 3: Deploy the current branch as a preview without promoting it to production.**
- [ ] **Step 4: Read the complete build events/logs; record the first real source/configuration failure if the deployment is not `READY`.**
- [ ] **Step 5: Make the smallest coherent repository/project-setting correction required by those logs, keeping all changes on the same branch.**
- [ ] **Step 6: Redeploy and repeat until the preview is `READY` or an external blocker is proven.**
- [ ] **Step 7: Verify preview `/` returns the Vite app, a client-side route falls back to `index.html`, and `/api/health` reaches the Marketing Agency Fly backend rather than the SPA fallback.**
- [ ] **Step 8: Commit the final Vercel/repository configuration changes.**

### Task 3: Qualify deterministic repository install, test, and build behavior

**Files:**
- Read/modify only if failures prove it necessary: `package.json`, `package-lock.json`, `frontend/package.json`, `backend/package.json`, relevant test/lint config.
- Test: root workspace install/lint/test/build commands.

**Interfaces:**
- Consumes: repository manifests and exact Node/npm versions already declared by the project.
- Produces: reproducible commands that pass outside the Vercel deployment environment.

- [ ] **Step 1: Verify lockfile/workspace coherence for root, frontend, and backend packages.**
- [ ] **Step 2: Run `npm ci --no-audit --no-fund`; expected result: successful deterministic install.**
- [ ] **Step 3: Run backend lint; expected result: exit 0.**
- [ ] **Step 4: Run backend tests; expected result: all required tests pass without mocked production-success behavior.**
- [ ] **Step 5: Run frontend tests; expected result: all required tests pass.**
- [ ] **Step 6: Run `npm run build --workspace=frontend`; expected result: `frontend/dist` is produced successfully.**
- [ ] **Step 7: Fix only failures proven by these commands, then rerun the failed command and the full sequence.**
- [ ] **Step 8: Commit any required manifest/lock/test/build corrections.**

### Task 4: Diagnose and restore the GitHub Actions CI release gate

**Files:**
- Modify only if evidence points to workflow source: `.github/workflows/ci.yml`
- Test: GitHub Actions run on the branch/PR.

**Interfaces:**
- Consumes: passing repository commands from Task 3.
- Produces: a GitHub Actions CI run that obtains a runner and actually executes the validation steps.

- [ ] **Step 1: Enumerate recent `CI/CD` workflow runs and identify the last successful run and first zero-step/no-runner failure.**
- [ ] **Step 2: Compare workflow file, triggering event, permissions-visible metadata, and job payloads across the transition.**
- [ ] **Step 3: If the failure is workflow-source-related, write the smallest workflow correction and commit it on the same branch.**
- [ ] **Step 4: If the failure is account/repository policy, billing, or runner allocation outside accessible controls, label it explicitly as an external blocker and do not fake a passing gate.**
- [ ] **Step 5: Trigger/re-run CI only when there is a concrete reason it can execute; expected result: runner assigned and all validation steps execute.**
- [ ] **Step 6: Verify the Docker build job runs after validation and succeeds.**

### Task 5: Verify Fly deployment path without cross-product coupling

**Files:**
- Read/modify if proven necessary: `fly.toml`, `Dockerfile`, `.github/workflows/deploy-production.yml`.
- Test: Fly deployment/health path using the dedicated app `trillionai-marketing`.

**Interfaces:**
- Consumes: passing CI and verified backend origin.
- Produces: a release workflow that targets only the Marketing Agency Fly app and validates its health/auth boundary.

- [ ] **Step 1: Confirm `fly.toml` app name is `trillionai-marketing`, region/settings are product-specific, and no AppForge identifiers exist.**
- [ ] **Step 2: Confirm deploy workflow checks out the exact validated SHA and deploys only `--app trillionai-marketing`.**
- [ ] **Step 3: Verify required Fly runtime secret names are Marketing-specific and no secret values are stored in Git.**
- [ ] **Step 4: Verify `/health`, `/`, and anonymous `/api/agents` checks match the actual application contract.**
- [ ] **Step 5: If CI is green and Fly credentials/resources are available, run/observe the deployment and require the health/auth checks to pass; otherwise mark the exact missing credential/resource as externally blocked.**
- [ ] **Step 6: Commit any source/configuration corrections required by the verified Fly path.**

### Task 6: Release-foundation qualification and merge decision

**Files:**
- Review all files changed since `main` on `fix/vercel-production-routing`.
- No new feature files unless review finds a release-foundation defect.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: either a merge-ready release-foundation branch or a precise blocked/unverified report with no false completion claim.

- [ ] **Step 1: Compare `main...fix/vercel-production-routing` and verify every change belongs to the release-foundation slice.**
- [ ] **Step 2: Re-run/confirm Vercel preview readiness, repository install/lint/test/build, GitHub Actions execution, and Fly release-path checks.**
- [ ] **Step 3: Search changed configuration for AppForge identifiers, placeholder backend URLs, fabricated secrets, and stale project IDs; expected result: none.**
- [ ] **Step 4: Open one PR only after the branch is ready for review; do not create a PR backlog.**
- [ ] **Step 5: Merge normally only if executable qualification actually ran and passed.**
- [ ] **Step 6: Re-read `main` after merge and verify it contains the exact qualified release-foundation state before starting the database-foundation plan.**
