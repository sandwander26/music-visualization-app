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
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      token: token.trim(),
      newPassword,
    },
  })
}

export async function fetchMe(token: string): Promise<{
  user: AuthUser
  storage: StorageInfo
}> {
  return apiFetch('/me', { token })
}

export async function updateAccountEmail(
  token: string,
  currentPassword: string,
  newEmail: string,
): Promise<{ token: string; user: AuthUser }> {
  return apiFetch('/me/email', {
    method: 'PATCH',
    token,
    body: { currentPassword, newEmail: newEmail.trim().toLowerCase() },
  })
}

export async function updateAccountPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return apiFetch('/me/password', {
    method: 'PATCH',
    token,
    body: { currentPassword, newPassword },
  })
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function fetchProfileAvatarObjectUrl(token: string): Promise<string | null> {
  let res: Response
  try {
    res = await fetch(`${getApiBaseUrl()}/me/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  } catch {
    throw new Error('не удалось загрузить фото профиля')
  }
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    let err = `ошибка ${res.status}`
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) err = j.error
    } catch {
      if (text.includes('Cannot GET')) {
        err = 'сервер устарел — перезапусти API (npm run server:dev в папке server)'
      }
    }
    throw new Error(err)
  }
  const blob = await res.blob()
  if (!blob.size) return null
  return URL.createObjectURL(blob)
}

export async function putProfileAvatar(
  token: string,
  mime: string,
  dataBase64: string,
): Promise<void> {
  await apiFetch('/me/avatar', { method: 'PUT', token, body: { mime, dataBase64 } })
}

export async function deleteProfileAvatar(token: string): Promise<void> {
  await apiFetch('/me/avatar', { method: 'DELETE', token })
}

export async function fetchSnapshot(token: string): Promise<SyncSnapshot> {
  return apiFetch('/sync/snapshot', { token })
}

export async function putSettings(token: string, settings: AppSettings): Promise<void> {
  await apiFetch('/sync/settings', { method: 'PUT', token, body: { settings } })
}

export async function putPresets(
  token: string,
  data: { currentParams: Record<string, unknown>; savedPresets: unknown[] },
): Promise<void> {
  await apiFetch('/sync/presets', { method: 'PUT', token, body: { data } })
}

export async function putUserViz(token: string, items: UserVizCloudItem[]): Promise<void> {
  await apiFetch('/sync/user-viz', { method: 'PUT', token, body: { items } })
}

export async function putLibrary(
  token: string,
  items: { trackId: string; item: CloudLibraryItemPayload }[],
): Promise<void> {
  await apiFetch('/sync/library', { method: 'PUT', token, body: { items } })
}

export async function putTrackLrc(
  token: string,
  trackId: string,
  payload: { lrcText: string; catalogArtist?: string; catalogTitle?: string },
): Promise<void> {
  await apiFetch(`/sync/tracks/${encodeURIComponent(trackId)}/lrc`, {
    method: 'PUT',
    token,
    body: payload,
  })
}

export async function putTrackCover(
  token: string,
  trackId: string,
  mime: string,
  dataBase64: string,
): Promise<void> {
  await apiFetch(`/sync/tracks/${encodeURIComponent(trackId)}/cover`, {
    method: 'PUT',
    token,
    body: { mime, dataBase64 },
  })
}

export async function putTrackAudio(
  token: string,
  trackId: string,
  mime: string,
  dataBase64: string,
): Promise<{ storage?: { audioBytesUsed: number; audioQuotaBytes: number } }> {
  return apiFetch(`/sync/tracks/${encodeURIComponent(trackId)}/audio`, {
    method: 'PUT',
    token,
    body: { mime, dataBase64 },
  })
}

export async function fetchTrackAudio(
  token: string,
  trackId: string,
): Promise<{ mime: string; sizeBytes: number; dataBase64: string }> {
  return apiFetch(`/sync/tracks/${encodeURIComponent(trackId)}/audio`, { token })
}

export async function deleteTrackAudio(token: string, trackId: string): Promise<void> {
  await apiFetch(`/sync/tracks/${encodeURIComponent(trackId)}/audio`, {
    method: 'DELETE',
    token,
  })
}
