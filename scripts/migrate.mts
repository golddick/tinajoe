import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run database migrations.')
}

const migrationDirectory = path.join(process.cwd(), 'drizzle')
const migrationTable = 'public.cake_customization_migrations'
const advisoryLockId = '729481020236'
const pool = new Pool({ connectionString })

function isMigrationFile(filename: string) {
  return /^\d+_.+\.sql$/.test(filename)
}

function normalizeMigrationSql(sql: string) {
  return sql
    .replace(/^\s*BEGIN\s*;\s*$/gim, '')
    .replace(/^\s*COMMIT\s*;\s*$/gim, '')
}

async function main() {
  const client = await pool.connect()
  let lockAcquired = false

  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [advisoryLockId])
    lockAcquired = true
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationTable} (
        migration_name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const files = (await readdir(migrationDirectory))
      .filter(isMigrationFile)
      .sort()
    const appliedResult = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM ${migrationTable}`,
    )
    const applied = new Set(
      appliedResult.rows.map((row) => row.migration_name),
    )

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Already applied: ${filename}`)
        continue
      }

      const sql = normalizeMigrationSql(
        await readFile(path.join(migrationDirectory, filename), 'utf8'),
      )
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          `INSERT INTO ${migrationTable} (migration_name) VALUES ($1)`,
          [filename],
        )
        await client.query('COMMIT')
        console.log(`Applied: ${filename}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration failed: ${filename}`, { cause: error })
      }
    }

    if (files.length === 0) {
      console.log('No SQL migration files found.')
    }
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [
        advisoryLockId,
      ])
    }
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed:', error)
  process.exitCode = 1
})
