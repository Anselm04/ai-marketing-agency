import fs from 'node:fs/promises';
import pg from 'pg';
import { prepareJsonSnapshot, importJsonSnapshot, snapshotDigest, buildMigrationPlan } from '../src/utils/jsonMigration.js';

const help = `Marketing JSON cutover (operator-only; never run against a writing app):
  node backend/scripts/migrate-json.js prepare --source /frozen/backend/data --out /private/snapshot.json --writes-frozen
  node backend/scripts/migrate-json.js rehearse --snapshot /private/snapshot.json --sha256 REVIEWED_DIGEST --writes-frozen
  node backend/scripts/migrate-json.js apply --snapshot /private/snapshot.json --sha256 REVIEWED_DIGEST --writes-frozen
Database commands use DATABASE_URL or SUPABASE_DB_URL. Rehearse always rolls back.
Keep snapshots private: they contain password hashes, settings and customer records.`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === '--help') { console.log(help); return; }
  if (!['prepare', 'rehearse', 'apply'].includes(command)) throw new Error(help);
  const allowed = command === 'prepare' ? ['--source', '--out'] : ['--snapshot', '--sha256'];
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (Object.hasOwn(options, arg)) throw new Error('Duplicate option');
    if (arg === '--writes-frozen') options[arg] = true;
    else if (allowed.includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg] = args[++i];
    else throw new Error('Unknown or incomplete option');
  }
  if (!options['--writes-frozen'] || allowed.some((key) => !options[key])) throw new Error('Required options missing; use --help');
  if (command === 'prepare') {
    console.log(JSON.stringify(await prepareJsonSnapshot(options['--source'], options['--out'], { writesFrozen: true })));
    return;
  }
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('DATABASE_URL or SUPABASE_DB_URL required');
  const bytes = await fs.readFile(options['--snapshot']);
  if (snapshotDigest(bytes) !== options['--sha256']) throw new Error('Migration refused: snapshot: reviewed checksum required');
  buildMigrationPlan(JSON.parse(bytes.toString('utf8')));
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await importJsonSnapshot(client, bytes, {
      expectedDigest: options['--sha256'], writesFrozen: true, commit: command === 'apply',
    })));
  } finally { await client.end(); }
}
main().catch((error) => {
  // Never print DB URLs, PostgreSQL detail, snapshot content, or file-system paths.
  console.error(error.message?.startsWith('Migration refused:') ? error.message : 'Migration command refused or failed. Check --help, source validation, reviewed checksum and database access. No success is confirmed.');
  process.exitCode = 1;
});
