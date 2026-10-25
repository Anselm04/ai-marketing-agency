import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');

describe('production image dependency reproducibility', () => {
  test('every npm dependency installation uses the committed root workspace lockfile', () => {
    const stages = dockerfile.split(/^FROM /m).slice(1);
    const installers = stages.filter(stage => /RUN npm (?:install|ci)/.test(stage));
    expect(installers.length).toBeGreaterThan(0);
    for (const stage of installers) {
      expect(stage).toMatch(/COPY package\.json package-lock\.json \.\//);
      expect(stage).toMatch(/COPY backend\/package\.json backend\//);
      expect(stage).toMatch(/COPY frontend\/package\.json frontend\//);
      expect(stage).toMatch(/RUN npm ci\b/);
      expect(stage).not.toMatch(/RUN npm install\b/);
    }
  });
  test('runtime stages install only backend production dependencies', () => {
    for (const name of ['backend', 'production']) {
      const stage = dockerfile.split(/^FROM /m).find(value => new RegExp(`AS ${name}\\n`).test(value));
      expect(stage).toMatch(/npm ci --omit=dev --workspace=backend/);
    }
  });
});
