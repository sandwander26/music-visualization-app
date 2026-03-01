import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR ?? './data'
const DB_PATH = path.join(DATA_DIR, 'loomi.sqlite')

fs.mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS library_items (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS track_lrc (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    lrc_text TEXT NOT NULL,
    catalog_artist TEXT,
    catalog_title TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS track_covers (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS track_audio (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS user_avatars (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_presets (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_viz (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viz_id TEXT NOT NULL,
    name TEXT NOT NULL,
    moods TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, viz_id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
`)

export function userHasAvatar(userId: string): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM user_avatars WHERE user_id = ?')
    .get(userId) as { ok: number } | undefined
  return Boolean(row)
}

export function audioBytesUsed(userId: string): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(size_bytes), 0) AS n FROM track_audio WHERE user_id = ?')
    .get(userId) as { n: number }
  return row.n
}

export function purgeOrphanTrackAttachments(userId: string): void {
  const sub = 'SELECT track_id FROM library_items WHERE user_id = ?'
  db.prepare(
    `DELETE FROM track_lrc WHERE user_id = ? AND track_id NOT IN (${sub})`,
  ).run(userId, userId)
  db.prepare(
    `DELETE FROM track_covers WHERE user_id = ? AND track_id NOT IN (${sub})`,
  ).run(userId, userId)
  db.prepare(
    `DELETE FROM track_audio WHERE user_id = ? AND track_id NOT IN (${sub})`,
  ).run(userId, userId)
}
