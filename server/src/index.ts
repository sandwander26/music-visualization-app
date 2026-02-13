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
  }

  if (isRateLimited(row.id)) {
    res.status(429).json({ error: 'слишком много запросов — попробуйте через час' })
    return
  }

  try {
    const code = createPasswordResetToken(row.id)
    const channel = await sendPasswordResetEmail(email, code)
    payload.delivery = channel
    if (channel === 'sent') {
      payload.message =
        'Код отправлен на почту. Проверьте входящие и папку «Спам» (письмо может идти 1–2 минуты).'
    } else {
      payload.message =
        'Почта не настроена на сервере (SMTP). Код выведен в консоль, где запущен npm run server:dev.'
      if (process.env.NODE_ENV !== 'production') {
        payload.devResetCode = code
      }
    }
    res.json(payload)
  } catch (err) {
    console.error('[mail] forgot-password:', err)
    res.status(503).json({ error: 'не удалось отправить письмо — проверьте SMTP' })
  }
})

app.post('/auth/reset-password', (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase()
  const token = String(req.body?.token ?? '').trim()
  const newPassword = String(req.body?.newPassword ?? '')

  if (!email || !token) {
    res.status(400).json({ error: 'укажите email и код из письма' })
    return
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'новый пароль минимум 8 символов' })
    return
  }

  const consumed = consumePasswordResetToken(email, token)
  if ('error' in consumed) {
    res.status(400).json({ error: consumed.error })
    return
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, consumed.userId)
  res.json({ ok: true, message: 'пароль обновлён — войдите с новым паролем' })
})

app.post('/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password ?? '')

  const row = db
    .prepare('SELECT id, email, password_hash, display_name FROM users WHERE email = ?')
    .get(email) as
    | { id: string; email: string; password_hash: string; display_name: string | null }
    | undefined

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'неверный email или пароль' })
    return
  }

  res.json({
    token: issueToken(row.id, row.email),
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      hasAvatar: userHasAvatar(row.id),
    },
  })
})

function userResponse(userId: string): {
  id: string
  email: string
  displayName: string | null
  hasAvatar: boolean
} | null {
  const row = db
    .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
    .get(userId) as { id: string; email: string; display_name: string | null } | undefined
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    hasAvatar: userHasAvatar(row.id),
  }
}

function verifyCurrentPassword(userId: string, password: string): boolean {
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(userId) as { password_hash: string } | undefined
  if (!row) return false
  return bcrypt.compareSync(password, row.password_hash)
}

app.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const user = userResponse(req.userId!)
  if (!user) {
    res.status(404).json({ error: 'пользователь не найден' })
    return
  }
  const used = audioBytesUsed(req.userId!)
  res.json({
    user,
    storage: {
      audioBytesUsed: used,
      audioQuotaBytes: AUDIO_QUOTA_BYTES,
      audioBytesFree: Math.max(0, AUDIO_QUOTA_BYTES - used),
    },
  })
})

app.patch('/me/email', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const currentPassword = String(req.body?.currentPassword ?? '')
  const newEmail = String(req.body?.newEmail ?? '')
    .trim()
    .toLowerCase()

  if (!currentPassword) {
    res.status(400).json({ error: 'введите текущий пароль' })
    return
  }
  if (!verifyCurrentPassword(userId, currentPassword)) {
    res.status(401).json({ error: 'неверный текущий пароль' })
    return
  }
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    res.status(400).json({ error: 'некорректный email' })
    return
  }

  const self = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as
    | { email: string }
    | undefined
  if (!self) {
    res.status(404).json({ error: 'пользователь не найден' })
    return
  }
  if (newEmail === self.email.toLowerCase()) {
    res.status(400).json({ error: 'это уже ваш email' })
    return
  }

  const taken = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(newEmail, userId)
  if (taken) {
    res.status(409).json({ error: 'email уже занят' })