import { getApiBaseUrl } from '../config/api'
import type { AppSettings } from '../store/settingsStore'
import type { AuthUser } from '../store/authStore'

export interface StorageInfo {
  audioBytesUsed: number
  audioQuotaBytes: number
  audioBytesFree: number
}

export interface CloudLibraryItemPayload {
  id: string
  title: string
  artist: string
  album: string
  originalFileName: string | null
  sourceFileSize?: number | null
  durationSec: number
  addedAt: string
  features?: unknown
  moodWeights?: unknown
  
  hasLocalAudio?: boolean
}

export interface SyncSnapshot {
  settings: { json: AppSettings; updatedAt: number } | null
  library: { trackId: string; item: CloudLibraryItemPayload; updatedAt: number }[]
  lrc: {
    trackId: string
    lrcText: string
    catalogArtist?: string
    catalogTitle?: string
    updatedAt: number
  }[]
  covers: { trackId: string; mime: string; dataBase64: string; updatedAt: number }[]
  cloudAudio: { trackId: string; mime: string; sizeBytes: number; updatedAt: number }[]
  presets: { data: { currentParams: Record<string, unknown>; savedPresets: unknown[] }; updatedAt: number } | null
  userViz: {
    vizId: string
    name: string
    moods: string[]
    source: string
    createdAt: string
    updatedAt: number
  }[]
  serverTime: number
}

export interface UserVizCloudItem {
  vizId: string
  name: string
  moods: string[]
  source: string
  createdAt: string
}

async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body != null) headers['Content-Type'] = 'application/json'
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  let res: Response
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: opts.method ?? (opts.body != null ? 'POST' : 'GET'),
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new Error('не удалось связаться с сервером — запущен ли loomi-server?')
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!res.ok) {
    let err = `ошибка ${res.status}`
    if (data && typeof data === 'object' && 'error' in data) {
      err = String((data as { error: string }).error)
    } else if (typeof text === 'string' && text.includes('Cannot PUT')) {
      err = 'сервер устарел — перезапусти API (npm run server:dev в папке server)'
    } else if (typeof text === 'string' && text.length < 200 && text.trim()) {
      err = text.trim()
    }
    throw new Error(err)
  }

  return data as T
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/auth/login', { method: 'POST', body: { email, password } })
}

export async function register(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { email, password, displayName: displayName?.trim() || undefined },
  })
}

export async function requestPasswordReset(
  email: string,
): Promise<{
  ok: boolean
  message: string
  delivery?: 'email' | 'console'
  devResetCode?: string
}> {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
  })
}

export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/auth/reset-password', {