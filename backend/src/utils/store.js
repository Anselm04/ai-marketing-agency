import jsonStore from './jsonStore.js';

const hasPostgresUrl = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
const mustUsePostgres = process.env.NODE_ENV === 'production';

if (mustUsePostgres && !hasPostgresUrl) {
  throw new Error(
    'Production startup blocked: DATABASE_URL or SUPABASE_DB_URL is required for Marketing Agency PostgreSQL persistence.',
  );
}

const store = hasPostgresUrl
  ? (await import('./postgresStore.js')).default
  : jsonStore;

export default store;
