---
name: raw-postgres-pg
description: "Work with this repo's PostgreSQL layer, which uses the raw pg driver in src/lib/postgres.ts - not the Prisma client. Covers schema migrations, pool and transaction usage, JSONB columns and the failure mode where table init silently swallows errors."
risk: critical
source: project
date_added: "2026-10-09"
---

# Raw PostgreSQL (`pg`)

This project persists to PostgreSQL through the **raw `pg` driver**. `prisma/schema.prisma`
exists as a design artifact, but no Prisma client is imported anywhere at runtime - do not
add `@prisma/client` calls or run `prisma migrate` expecting them to take effect.

## Use this skill when

- Adding or altering a table or column
- Writing or debugging a query in a route handler
- Adding persistence for a new feature
- Diagnosing a 500 whose cause is "database unavailable"

## Do not use this skill when

- The task is about `prisma/schema.prisma` as a document rather than runtime behaviour
- The work does not touch `src/lib/postgres.ts` or raw SQL

## Instructions

### 1. One pool, one module

`src/lib/postgres.ts` owns the only `Pool`. Every route imports it:

```ts
import pool, { initPostgresTables } from '@/lib/postgres';
```

The module reads `DATABASE_URL` at import time and **throws if it is unset** - a missing
`DATABASE_URL` fails the whole route, not one query. `DATABASE_URL` must name a database
that actually exists on the server; if it does not, every DB-backed route 500s while
stateless routes (e.g. `/api/social/platforms`) keep returning 200. That asymmetry is the
fastest way to spot a wrong database name.

### 2. `initPostgresTables()` is the migration system

There are no migration files. Schema changes are idempotent DDL run at request time:

```ts
await client.query(`CREATE TABLE IF NOT EXISTS posts (...)`);
await client.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`);
```

- Call `initPostgresTables()` before the first query in any DB-touching route.
- It is guarded by a module-level `isInitialized` flag, so repeated calls are cheap.
- To add a column: append one `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` line. Never edit or
  reorder existing statements - already-migrated databases only ever run the new one.
- Add an index with `CREATE INDEX IF NOT EXISTS`.

### 3. It swallows errors - know this failure mode

`initPostgresTables()` catches and only `console.error`s (`PostgreSQL table init error: ...`).
A failed init **does not throw**, so the request continues and fails later on the next query
with a confusing error. When a route 500s for an unclear reason, check the server log for
that line first - it names the real cause (wrong database, auth failure, unreachable host).

### 4. Transactions

Multi-statement writes go through a checked-out client, never `pool.query` directly:

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();          // always, or the pool leaks
}
```

`src/app/api/calendar/generate/route.ts` is the reference implementation.

### 5. Query rules

- Parameterised placeholders only: `$1, $2`. Never interpolate user input into SQL.
- `pool.query()` for single statements; a checked-out client for transactions.
- Always `client.release()` in `finally`.
- Rows come back snake_case; map to camelCase at the module boundary (see `getDbUsers()`).
- Timestamps are `TIMESTAMPTZ DEFAULT NOW()`.
- Ids are `VARCHAR(64)` and generated in application code with a typed prefix:
  `usr_`, `conn_`, `post_`, `cal_`, `sub_`. There are no DB sequences.

### 6. Idempotent writes

Publishing and generation retry, so writes must tolerate a repeat:

- `INSERT ... ON CONFLICT (id) DO NOTHING` for rows keyed by an app-generated id
- `ON CONFLICT (user_id) DO UPDATE SET ...` for the one-row-per-user tables

### 7. JSONB columns

Flexible structures are `JSONB`, parsed by the caller:

- `content_calendars.days_json` - the whole batched calendar
- `posts.tagged_users` - `urn:li:person:...` mentions, `DEFAULT '[]'::jsonb`
- `posts.reference_urls` - user-supplied input images for generation

`JSON.stringify` on write; the column returns a parsed object on read.

### 8. Seeding

Seed data is inserted only when `SELECT COUNT(*) FROM users` is 0, so an existing database is
never overwritten. Do not add seed statements that run unconditionally.

### 9. Tables

`users`, `subscriptions`, `social_connections`, `content_calendars`, `posts`, `audit_logs`.

`posts` carries the publish bookkeeping: `published_at`, `publish_error`, `publish_attempts`,
`external_id`, `external_url`, plus `manual_published_at` / `manual_external_url` which record
a "Dispatch Now" separately from the scheduled publish.

### 10. Verifying a change

There is no test suite for the DB layer. Verify with a real connection:

```
psql "<DATABASE_URL>" -c "\d posts"
psql "<DATABASE_URL>" -c "select id, status, scheduled_time from posts order by created_at desc limit 5"
```

On this machine `psql` is at `C:\Program Files\PostgreSQL\18\bin\psql.exe`.

## Resources

- `src/lib/postgres.ts` - pool, DDL, accessors
- `src/app/api/calendar/generate/route.ts` - transaction reference
- `prisma/schema.prisma` - design reference only, not runtime

## Limitations

- The app's idempotent-DDL approach means there is no down-migration; schema changes are forward-only.
- Concurrent first requests can race on `isInitialized`; the DDL is idempotent so this is safe but can log noise.
- Verify against a real database - there is no automated safety net here.
