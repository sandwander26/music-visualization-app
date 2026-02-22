import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db } from './db.js'

const RESET_TTL_MS = 60 * 60 * 1000
const MAX_REQUESTS_PER_HOUR = 5

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateResetCode(): string {
  return randomBytes(8).toString('base64url').replace(/[-_]/g, 'x').slice(0, 10).toUpperCase()
}

export function countRecentResetRequests(userId: string): number {
  const since = Date.now() - 60 * 60 * 1000
  const row = db
    .prepare(
      'SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND created_at > ?',
    )
    .get(userId, since) as { n: number }
  return row.n
}

export function isRateLimited(userId: string): boolean {
  return countRecentResetRequests(userId) >= MAX_REQUESTS_PER_HOUR
}

export function createPasswordResetToken(userId: string): string {
  const code = generateResetCode()
  const now = Date.now()
  const expiresAt = now + RESET_TTL_MS
  const tokenHash = hashResetToken(code)

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(userId)
    db.prepare(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(randomUUID(), userId, tokenHash, expiresAt, now)
  })
  tx()
  return code
}

export function consumePasswordResetToken(
  email: string,
  token: string,
): { userId: string } | { error: string } {
  const normalized = email.trim().toLowerCase()
  const row = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalized) as { id: string } | undefined
  if (!row) {
    return { error: 'неверный код или email' }
  }

  const tokenHash = hashResetToken(token.trim().toUpperCase())
  const resetRow = db
    .prepare(
      'SELECT id, expires_at FROM password_reset_tokens WHERE user_id = ? AND token_hash = ?',
    )
    .get(row.id, tokenHash) as { id: string; expires_at: number } | undefined

  if (!resetRow) {
    return { error: 'неверный код или email' }
  }
  if (resetRow.expires_at < Date.now()) {
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(row.id)
    return { error: 'код истёк — запросите новый' }
  }

  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(row.id)
  return { userId: row.id }
}
