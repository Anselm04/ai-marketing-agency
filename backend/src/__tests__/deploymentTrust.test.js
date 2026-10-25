import fs from 'node:fs';
import { describe, expect, test } from '@jest/globals';

const workflow = fs.readFileSync(new URL('../../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
const expression = workflow.match(/ {4}if: >-\n([\s\S]*?)\n {4}runs-on:/)[1].trim();
const allowed = new Function('github', `return (${expression});`);

function context(overrides = {}) {
  return {
    event_name: 'workflow_run',
    repository: 'Anselm04/ai-marketing-agency',
    ref: 'refs/heads/main',
    event: { workflow_run: {
      conclusion: 'success', event: 'push', head_branch: 'main',
      head_repository: { full_name: 'Anselm04/ai-marketing-agency' },
      ...overrides,
    } },
  };
}

describe('production source trust', () => {
  test('accepts a successful upstream main push', () => expect(allowed(context())).toBe(true));
  test.each([
    { event: 'pull_request' },
    { head_repository: { full_name: 'attacker/fork' } },
    { head_repository: null },
    { head_branch: 'develop' },
    { conclusion: 'failure' },
  ])('rejects an untrusted or unsuccessful run: %j', (run) => {
    expect(Boolean(allowed(context(run)))).toBe(false);
  });
  test('manual deployment is confined to main', () => {
    expect(allowed({ ...context(), event_name: 'workflow_dispatch' })).toBe(true);
    expect(Boolean(allowed({ ...context(), event_name: 'workflow_dispatch', ref: 'refs/heads/feature' }))).toBe(false);
  });
});
