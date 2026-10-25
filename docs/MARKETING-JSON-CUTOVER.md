# Preserve live Marketing data before PostgreSQL cutover

The live older image uses JSON despite having a database URL. Redeploying the current code does **not** transfer those records. The authenticated `/api/export/backup` is a per-customer export with password hashes omitted; it cannot restore the full application.

## Before capture

1. Inventory **every** live instance and volume. Locate the actual directory used by the deployed JSON adapter, typically `/app/backend/data`; do not assume `DATA_DIR=/data` changes that older adapter. Compare instance data and reconcile divergent records before proceeding.
2. Schedule downtime. Block external requests, webhooks, scheduled jobs and other writers, then stop application processes. Keep writers stopped until final cutover or rollback. `--writes-frozen` is an operator assertion, not a mechanism that stops the app.
3. Make a protected copy of the entire old filesystem/volume and a database backup. Preserve the deployed image, secrets (including JWT/encryption keys), uploads and all JSON files. Record paths, checksums and capture time privately. This tool packages only the 13 legacy JSON-store collections, not uploads, in-memory OAuth metadata or external provider state. Preserve separately any existing PostgreSQL usage/billing records written by the older app.
4. Work from a frozen copy of the live files, never the repository's seed data. The source must contain all 13 JSON files written by `jsonStore._save()`: users, organizations, invites, agents, campaigns, content, leads, legalDocs, tasks, subscriptions, analytics, settings and godCodes. Missing files, unfamiliar JSON files, invalid records, duplicate identities or ambiguous ownership block migration. Reconcile explicitly; do not fabricate empty files to pass validation.

## Prepare and review (no database connection)

Run from the repository root with Node 22 and the locked dependencies installed:

```sh
node backend/scripts/migrate-json.js prepare \
  --source /private/frozen-marketing/backend/data \
  --out /private/marketing-snapshot.json --writes-frozen
```

The command creates a new file with mode `0600`, refuses overwrite, and prints only collection counts and the SHA-256 digest. The snapshot includes original file contents and per-file checksums. It contains password hashes, customer data and encrypted settings: keep it outside Git, public output directories and build artifacts. An interrupted output is not confirmed valid unless the command exits successfully.

Review counts against the frozen source and retain the printed digest separately. Verify the privileged owner account belongs to the intended person. Source roles are preserved without granting new roles. Unknown user fields block import because the PostgreSQL user schema has no generic payload column. Other entity payloads are preserved as JSONB. Bcrypt hashes are copied without hashing again; email casing is normalized for the destination adapter. Timestamps must be present and valid. OAuth ciphertext needs the original encryption secret after cutover.

## Rehearse on an isolated PostgreSQL database

Provision an isolated database with the same Marketing schema, indexes, constraints and runtime role as production. Use an environment-provided database URL with appropriate TLS settings; do not put credentials in command arguments.

```sh
node backend/scripts/migrate-json.js rehearse \
  --snapshot /private/marketing-snapshot.json \
  --sha256 REVIEWED_64_CHARACTER_DIGEST --writes-frozen
```

Rehearse inserts and verifies every mapped field and collection count, then rolls back. Success reports `committed:false`. It does not call providers. It requires **every existing table in the `marketing` schema to be empty**, including newer usage, social and billing-related tables. If any table is occupied, stop and reconcile both sources; the tool will not overwrite, merge or delete destination records. RLS cannot be used to hide existing rows. A single transaction and table locks prevent concurrent destination writers during validation/import. The source must remain frozen separately.

## Apply and verify

Only after the frozen source, backup and rehearsal are verified, set the intended production database URL and run the same command with `apply` instead of `rehearse`. `apply` commits the verified transaction; failure attempts rollback and exits nonzero. A connection loss during commit can leave the outcome uncertain: inspect the database before retrying. Re-running against a populated destination is refused.

Before reopening traffic, verify login with migrated credentials, campaign/content ownership, subscription entitlements against Stripe, settings decryption, quotas and uploads. Check `/ready` with the actual deployment role and secrets. Configuration checks do not prove provider credentials work. Retain the snapshot and backups until acceptance is complete.

## Rollback boundary

Before accepting new traffic, rollback means restoring the old image/secrets with its frozen JSON data and reopening only that version. Keep the imported PostgreSQL data for investigation; this tool offers no automatic deletion. Once the new app accepts writes, switching back to the old JSON image would lose those new changes. Freeze traffic again and reconcile/export new database changes before any rollback. Never run both writers concurrently.
