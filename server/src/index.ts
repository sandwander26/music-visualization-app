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
    return
  }

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, userId)
  const user = userResponse(userId)
  if (!user) {
    res.status(404).json({ error: 'пользователь не найден' })
    return
  }
  res.json({ token: issueToken(userId, newEmail), user })
})

app.patch('/me/password', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const currentPassword = String(req.body?.currentPassword ?? '')
  const newPassword = String(req.body?.newPassword ?? '')

  if (!currentPassword) {
    res.status(400).json({ error: 'введите текущий пароль' })
    return
  }
  if (!verifyCurrentPassword(userId, currentPassword)) {
    res.status(401).json({ error: 'неверный текущий пароль' })
    return
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'новый пароль минимум 8 символов' })
    return
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'новый пароль должен отличаться от текущего' })
    return
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
  res.json({ ok: true })
})

app.get('/me/avatar', requireAuth, (req: AuthedRequest, res) => {
  const row = db
    .prepare('SELECT mime, data FROM user_avatars WHERE user_id = ?')
    .get(req.userId!) as { mime: string; data: Buffer } | undefined
  if (!row) {
    res.status(404).json({ error: 'аватар не задан' })
    return
  }
  res.setHeader('Content-Type', row.mime)
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.send(row.data)
})

app.put('/me/avatar', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const mime = String(req.body?.mime ?? 'image/jpeg')
  const dataBase64 = String(req.body?.dataBase64 ?? '')
  if (!dataBase64) {
    res.status(400).json({ error: 'ожидается dataBase64' })
    return
  }
  if (!AVATAR_MIMES.has(mime)) {
    res.status(400).json({ error: 'формат: JPEG, PNG, WebP или GIF' })
    return
  }
  const buf = Buffer.from(dataBase64, 'base64')
  if (buf.length > AVATAR_MAX_BYTES) {
    res.status(413).json({ error: 'фото больше 2 МБ' })
    return
  }
  const now = Date.now()
  db.prepare(
    `INSERT INTO user_avatars (user_id, mime, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, mime, buf, now)
  res.json({ ok: true, updatedAt: now, hasAvatar: true })
})

app.delete('/me/avatar', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM user_avatars WHERE user_id = ?').run(req.userId!)
  res.json({ ok: true, hasAvatar: false })
})

app.get('/sync/snapshot', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!

  const settingsRow = db
    .prepare('SELECT json, updated_at FROM user_settings WHERE user_id = ?')
    .get(userId) as { json: string; updated_at: number } | undefined

  const libraryRows = db
    .prepare('SELECT track_id, json, updated_at FROM library_items WHERE user_id = ?')
    .all(userId) as { track_id: string; json: string; updated_at: number }[]

  const lrcRows = db
    .prepare(
      'SELECT track_id, lrc_text, catalog_artist, catalog_title, updated_at FROM track_lrc WHERE user_id = ?',
    )
    .all(userId) as {
    track_id: string
    lrc_text: string
    catalog_artist: string | null
    catalog_title: string | null
    updated_at: number
  }[]

  const coverRows = db
    .prepare('SELECT track_id, mime, data, updated_at FROM track_covers WHERE user_id = ?')
    .all(userId) as { track_id: string; mime: string; data: Buffer; updated_at: number }[]

  const audioRows = db
    .prepare('SELECT track_id, mime, size_bytes, updated_at FROM track_audio WHERE user_id = ?')
    .all(userId) as { track_id: string; mime: string; size_bytes: number; updated_at: number }[]

  const presetsRow = db
    .prepare('SELECT json, updated_at FROM user_presets WHERE user_id = ?')
    .get(userId) as { json: string; updated_at: number } | undefined

  const userVizRows = db
    .prepare(
      'SELECT viz_id, name, moods, source, created_at, updated_at FROM user_viz WHERE user_id = ?',
    )
    .all(userId) as {
    viz_id: string
    name: string
    moods: string
    source: string
    created_at: string
    updated_at: number
  }[]

  res.json({
    settings: settingsRow
      ? { json: JSON.parse(settingsRow.json), updatedAt: settingsRow.updated_at }
      : null,
    library: libraryRows.map((r) => ({
      trackId: r.track_id,
      item: JSON.parse(r.json),
      updatedAt: r.updated_at,
    })),
    lrc: lrcRows.map((r) => ({
      trackId: r.track_id,
      lrcText: r.lrc_text,
      catalogArtist: r.catalog_artist ?? undefined,
      catalogTitle: r.catalog_title ?? undefined,
      updatedAt: r.updated_at,
    })),
    covers: coverRows.map((r) => ({
      trackId: r.track_id,
      mime: r.mime,
      dataBase64: r.data.toString('base64'),
      updatedAt: r.updated_at,
    })),
    cloudAudio: audioRows.map((r) => ({
      trackId: r.track_id,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      updatedAt: r.updated_at,
    })),
    presets: presetsRow
      ? { data: JSON.parse(presetsRow.json), updatedAt: presetsRow.updated_at }
      : null,
    userViz: userVizRows.map((r) => ({
      vizId: r.viz_id,
      name: r.name,
      moods: JSON.parse(r.moods) as string[],
      source: r.source,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    serverTime: Date.now(),
  })
})

app.put('/sync/presets', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const data = req.body?.data
  if (!data || typeof data !== 'object') {
    res.status(400).json({ error: 'ожидается data object' })
    return
  }
  const now = Date.now()
  db.prepare(
    `INSERT INTO user_presets (user_id, json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(data), now)
  res.json({ ok: true, updatedAt: now })
})

app.put('/sync/user-viz', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const items = req.body?.items
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'ожидается items[]' })
    return
  }

  const upsert = db.prepare(
    `INSERT INTO user_viz (user_id, viz_id, name, moods, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, viz_id) DO UPDATE SET
       name = excluded.name,
       moods = excluded.moods,
       source = excluded.source,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
  )
  const del = db.prepare('DELETE FROM user_viz WHERE user_id = ? AND viz_id = ?')
  const now = Date.now()

  const tx = db.transaction(() => {
    const seen = new Set<string>()
    for (const raw of items) {
      const vizId = String(raw?.vizId ?? raw?.id ?? '').trim()
      const name = String(raw?.name ?? 'Без названия').trim()
      const source = String(raw?.source ?? '')
      const moods = Array.isArray(raw?.moods) ? raw.moods.map(String) : []
      const createdAt =
        typeof raw?.createdAt === 'string' ? raw.createdAt : new Date(now).toISOString()
      if (!vizId || !vizId.startsWith('user-') || !source.trim()) continue
      if (Buffer.byteLength(source, 'utf8') > USER_VIZ_MAX_BYTES) {
        throw new Error(`визуализатор ${vizId} больше лимита`)
      }
      seen.add(vizId)
      upsert.run(userId, vizId, name, JSON.stringify(moods), source, createdAt, now)
    }
    if (seen.size > USER_VIZ_MAX_ITEMS) {
      throw new Error(`не больше ${USER_VIZ_MAX_ITEMS} визуализаторов`)
    }
    const existing = db
      .prepare('SELECT viz_id FROM user_viz WHERE user_id = ?')
      .all(userId) as { viz_id: string }[]
    for (const row of existing) {
      if (!seen.has(row.viz_id)) del.run(userId, row.viz_id)
    }
  })

  try {
    tx()
    res.json({ ok: true, count: items.length, updatedAt: now })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(400).json({ error: msg })
  }
})

app.put('/sync/settings', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const json = req.body?.settings
  if (!json || typeof json !== 'object') {
    res.status(400).json({ error: 'ожидается settings object' })
    return
  }
  const now = Date.now()
  db.prepare(
    `INSERT INTO user_settings (user_id, json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(json), now)
  res.json({ ok: true, updatedAt: now })
})

app.put('/sync/library', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const items = req.body?.items
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'ожидается items[]' })
    return
  }

  const upsert = db.prepare(
    `INSERT INTO library_items (user_id, track_id, json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, track_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  )
  const del = db.prepare('DELETE FROM library_items WHERE user_id = ? AND track_id = ?')
  const now = Date.now()

  const delLrc = db.prepare('DELETE FROM track_lrc WHERE user_id = ? AND track_id = ?')
  const delCover = db.prepare('DELETE FROM track_covers WHERE user_id = ? AND track_id = ?')
  const delAudio = db.prepare('DELETE FROM track_audio WHERE user_id = ? AND track_id = ?')

  const tx = db.transaction(() => {
    const seen = new Set<string>()
    for (const raw of items) {
      const trackId = String(raw?.trackId ?? raw?.id ?? '').trim()
      const item = raw?.item ?? raw
      if (!trackId || !item || typeof item !== 'object') continue
      seen.add(trackId)
      upsert.run(userId, trackId, JSON.stringify(item), now)
    }
    const existing = db
      .prepare('SELECT track_id FROM library_items WHERE user_id = ?')
      .all(userId) as { track_id: string }[]
    for (const row of existing) {
      if (!seen.has(row.track_id)) {
        del.run(userId, row.track_id)
        delLrc.run(userId, row.track_id)
        delCover.run(userId, row.track_id)
        delAudio.run(userId, row.track_id)
      }
    }
  })
  tx()
  purgeOrphanTrackAttachments(userId)

  res.json({
    ok: true,
    count: items.length,
    updatedAt: now,
    storage: {
      audioBytesUsed: audioBytesUsed(userId),
      audioQuotaBytes: AUDIO_QUOTA_BYTES,
    },
  })
})

app.put('/sync/tracks/:trackId/lrc', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const trackId = String(req.params.trackId ?? '').trim()
  const lrcText = String(req.body?.lrcText ?? '')
  if (!trackId || !lrcText.trim()) {
    res.status(400).json({ error: 'trackId и lrcText обязательны' })
    return
  }
  const now = Date.now()
  const catalogArtist = req.body?.catalogArtist ? String(req.body.catalogArtist) : null
  const catalogTitle = req.body?.catalogTitle ? String(req.body.catalogTitle) : null

  db.prepare(
    `INSERT INTO track_lrc (user_id, track_id, lrc_text, catalog_artist, catalog_title, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, track_id) DO UPDATE SET
       lrc_text = excluded.lrc_text,
       catalog_artist = excluded.catalog_artist,
       catalog_title = excluded.catalog_title,
       updated_at = excluded.updated_at`,
  ).run(userId, trackId, lrcText, catalogArtist, catalogTitle, now)

  res.json({ ok: true, updatedAt: now })
})

app.delete('/sync/tracks/:trackId/lrc', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM track_lrc WHERE user_id = ? AND track_id = ?').run(
    req.userId!,
    req.params.trackId,
  )
  res.json({ ok: true })
})

app.put('/sync/tracks/:trackId/cover', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const trackId = String(req.params.trackId ?? '').trim()
  const mime = String(req.body?.mime ?? 'image/jpeg')
  const dataBase64 = String(req.body?.dataBase64 ?? '')
  if (!trackId || !dataBase64) {
    res.status(400).json({ error: 'trackId и dataBase64 обязательны' })
    return
  }
  const buf = Buffer.from(dataBase64, 'base64')
  if (buf.length > 3 * 1024 * 1024) {
    res.status(413).json({ error: 'обложка больше 3 МБ' })
    return
  }
  const now = Date.now()
  db.prepare(
    `INSERT INTO track_covers (user_id, track_id, mime, data, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, track_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, trackId, mime, buf, now)
  res.json({ ok: true, updatedAt: now })
})

app.put('/sync/tracks/:trackId/audio', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const trackId = String(req.params.trackId ?? '').trim()
  const mime = String(req.body?.mime ?? 'audio/mpeg')
  const dataBase64 = String(req.body?.dataBase64 ?? '')
  if (!trackId || !dataBase64) {
    res.status(400).json({ error: 'trackId и dataBase64 обязательны' })
    return
  }
  const buf = Buffer.from(dataBase64, 'base64')
  const sizeBytes = buf.length

  const prev = db
    .prepare('SELECT size_bytes FROM track_audio WHERE user_id = ? AND track_id = ?')
    .get(userId, trackId) as { size_bytes: number } | undefined
  const used = audioBytesUsed(userId)
  const usedWithout = used - (prev?.size_bytes ?? 0)
  if (usedWithout + sizeBytes > AUDIO_QUOTA_BYTES) {
    res.status(413).json({
      error: 'превышен лимит облачного аудио (500 МБ)',
      audioBytesUsed: usedWithout,
      audioQuotaBytes: AUDIO_QUOTA_BYTES,
    })
    return
  }

  const now = Date.now()
  db.prepare(
    `INSERT INTO track_audio (user_id, track_id, mime, size_bytes, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, track_id) DO UPDATE SET mime = excluded.mime, size_bytes = excluded.size_bytes, data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, trackId, mime, sizeBytes, buf, now)

  res.json({
    ok: true,
    updatedAt: now,
    storage: {
      audioBytesUsed: usedWithout + sizeBytes,
      audioQuotaBytes: AUDIO_QUOTA_BYTES,
    },
  })
})

app.get('/sync/tracks/:trackId/audio', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.userId!
  const trackId = String(req.params.trackId ?? '').trim()
  const row = db
    .prepare('SELECT mime, size_bytes, data FROM track_audio WHERE user_id = ? AND track_id = ?')
    .get(userId, trackId) as { mime: string; size_bytes: number; data: Buffer } | undefined
  if (!row) {
    res.status(404).json({ error: 'аудио в облаке не найдено' })
    return
  }
  res.json({
    mime: row.mime,
    sizeBytes: row.size_bytes,
    dataBase64: row.data.toString('base64'),
  })
})

app.delete('/sync/tracks/:trackId/audio', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM track_audio WHERE user_id = ? AND track_id = ?').run(
    req.userId!,
    req.params.trackId,
  )
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`[loomi-api] http://127.0.0.1:${PORT}`)
  if (!isSmtpConfigured()) {
    console.log(
      '[loomi-api] почта: SMTP не настроен — коды сброса только в этой консоли (см. docs/email-setup.md)',
    )
  }
  void verifySmtpOnStartup()
})
