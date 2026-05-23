import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'chats.db')

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (db) return db

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      page_images TEXT,
      artifact_html TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_key TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit(client_key, timestamp);

    PRAGMA foreign_keys = ON;
  `)

  // Run additive migrations. ALTER TABLE throws if the column already exists,
  // so each migration is wrapped in try/catch — safe for repeated startups.
  runMigrations(db)

  return db
}

/**
 * Applies schema migrations that need to run after the initial CREATE TABLE
 * block. Using try/catch on each ALTER TABLE is idiomatic for SQLite — there's
 * no IF NOT EXISTS syntax for ADD COLUMN prior to SQLite 3.37.
 */
function runMigrations(db: DatabaseSync): void {
  try { db.exec('ALTER TABLE messages ADD COLUMN checklist TEXT') } catch { /* already exists */ }
}
