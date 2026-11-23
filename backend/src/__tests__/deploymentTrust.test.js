import fs from 'node:fs';
import { describe, expect, test } from '@jest/globals';

const workflow = fs.readFileSync(
  new URL('../../../.github/workflows/deploy-production.yml', import.meta.url),
  'utf8',
);

describe('production deployment trust and billing hold', () => {
  test('deployment remains disabled under the owner-approved production hold', () => {
    // Require a real job-level condition, not a commented-out historical expression.
    expect(workflow).toMatch(/^ {2}deploy:\s*\n(?: {4}#[^\n]*\n)* {4}if: \$\{\{ false \}\}$/m);
  });

  test('the workflow cannot deploy unless explicitly changed and reviewed', () => {
    // Source-of-truth pinning is retained for any future owner-authorised restoration.
    expect(workflow).toContain("git fetch --no-tags --depth=1 origin main");
    expect(workflow).toContain('git rev-parse FETCH_HEAD');
    expect(workflow).toContain('git rev-parse HEAD');
    expect(workflow).toContain('workflow_run.head_sha');
    expect(workflow).toContain('event=push&status=success');
    expect(workflow).toContain('.head_repository.full_name == $repo');
  });

  test('production credentials are never bundled in the YAML', () => {
    expect(workflow).toContain('secrets.FLY_API_TOKEN');
    expect(workflow).not.toMatch(/FLY_API_TOKEN:\s*(?:["\x27]?fly_[A-Za-z0-9_-]{12,})/);
  });
});
