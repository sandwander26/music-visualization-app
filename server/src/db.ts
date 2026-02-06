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