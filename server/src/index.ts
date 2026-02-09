import './loadEnv.js'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { db, audioBytesUsed, purgeOrphanTrackAttachments, userHasAvatar } from './db.js'
import { isSmtpConfigured, sendPasswordResetEmail, verifySmtpOnStartup } from './mail.js'
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  isRateLimited,
} from './passwordReset.js'

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const PORT = Number(process.env.PORT ?? 8787)
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const AUDIO_QUOTA_BYTES = Number(process.env.AUDIO_QUOTA_BYTES ?? 524_288_000)
const USER_VIZ_MAX_BYTES = Number(process.env.USER_VIZ_MAX_BYTES ?? 512 * 1024)
const USER_VIZ_MAX_ITEMS = Number(process.env.USER_VIZ_MAX_ITEMS ?? 24)

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

type AuthPayload = { sub: string; email: string }

interface AuthedRequest extends Request {
  userId?: string
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'требуется авторизация' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'недействительный токен' })
  }
}

function issueToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: '30d' })
}

const app = express()
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '64mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'loomi-api',
    mail: isSmtpConfigured() ? 'smtp' : 'console-only',
  })
})

app.post('/auth/register', (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password ?? '')
  const displayName = String(req.body?.displayName ?? '').trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'некорректный email' })
    return
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'пароль минимум 8 символов' })
    return
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (exists) {
    res.status(409).json({ error: 'email уже зарегистрирован' })
    return
  }

  const id = randomUUID()
  const hash = bcrypt.hashSync(password, 10)
  const now = Date.now()
  db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, email, hash, displayName, now)

  const token = issueToken(id, email)
  res.status(201).json({
    token,
    user: { id, email, displayName, hasAvatar: false },
  })
})

app.post('/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase()

  const payload: {
    ok: boolean
    message: string
    delivery?: 'email' | 'console'
    devResetCode?: string
  } = {
    ok: true,
    message:
      'Если этот email зарегистрирован, вы получите инструкции для сброса пароля',
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.json(payload)
    return
  }

  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
    | { id: string }
    | undefined
  if (!row) {
    res.json(payload)
    return