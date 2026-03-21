import {
  deleteTrackAudio,
  fetchSnapshot,
  putLibrary,
  putPresets,
  putSettings,
  putTrackCover,
  putTrackLrc,
  putUserViz,
  type CloudLibraryItemPayload,
  type UserVizCloudItem,
} from './cloudApi'
import { readPresetsFromLocalStorage, writePresetsToLocalStorage } from '../presets/presetsCloud'
import { usePresetsStore } from '../presets/presetsStore'
import {
  ensureUserVizDirs,
  loadUserVizManifest,
  readUserVizFile,
  saveUserVizFile,
  saveUserVizManifest,
  isUserVizPersistenceAvailable,
} from '../userViz/storage'
import { useUserVizStore } from '../userViz/userVizStore'
import { compileUserViz } from '../userViz/compiler'
import type { UserVisualizerMeta, UserVisualizerRuntime } from '../userViz/types'
import type { MoodId } from '../audio/moodEngine'
import { useAuthStore } from '../store/authStore'
import { isPendingAudioPath } from '../utils/trackCloud'
import { readLyricsDiskCache, writeLyricsDiskCache } from './lyricsDiskCache'
import { useSettingsStore, type AppSettings } from '../store/settingsStore'
import { useLibraryStore } from '../store/libraryStore'
import { useUIStore } from '../store/uiStore'
import {
  ensureLibraryDirs,
  loadCoverBytes,
  saveLibraryManifest,
  loadLibraryManifest,
  isPersistenceAvailable,
  type PersistedTrack,
} from '../library/persistence'
import { idbSet } from '../utils/idb'

let pushTimer: ReturnType<typeof setTimeout> | null = null

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function coverExtForMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

function trackToCloudItem(t: {
  id: string
  name: string
  artist: string
  album: string
  originalFileName: string | null
  sourceFileSize?: number | null
  duration: number
  addedAt: number
  audioPath: string | null
  features?: unknown
  moodWeights?: unknown
}): CloudLibraryItemPayload {
  return {
    id: t.id,
    title: t.name,
    artist: t.artist,
    album: t.album,
    originalFileName: t.originalFileName,
    sourceFileSize: t.sourceFileSize ?? null,
    durationSec: t.duration,
    addedAt: new Date(t.addedAt).toISOString(),
    features: t.features ?? null,
    moodWeights: t.moodWeights ?? null,
    hasLocalAudio: Boolean(t.audioPath && !isPendingAudioPath(t.audioPath)),
  }
}

function cloudItemToPersisted(item: CloudLibraryItemPayload, coverPath: string | null): PersistedTrack {
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album ?? '',
    originalFileName: item.originalFileName,
    sourceFileSize: item.sourceFileSize ?? null,
    audioPath: `tracks/${item.id}.pending`,
    coverPath,
    features: (item.features as PersistedTrack['features']) ?? null,
    moodWeights: (item.moodWeights as PersistedTrack['moodWeights']) ?? null,
    addedAt: item.addedAt,
    durationSec: item.durationSec,
  }
}

async function refreshAuthStorage(): Promise<void> {
  const { useAuthStore } = await import('../store/authStore')
  try {
    await useAuthStore.getState().refreshMe()
  } catch (err) {
    console.warn('[cloud] refresh storage:', err)
  }
}

export async function flushCloudPush(token: string): Promise<void> {
  if (pushTimer != null) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  await pushCloudState(token)
  await refreshAuthStorage()
}

export async function purgeTracksFromCloud(token: string, trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return
  for (const trackId of trackIds) {
    try {
      await deleteTrackAudio(token, trackId)
    } catch (err) {
      console.warn('[cloud] delete audio', trackId, err)
    }
  }
  const { useAuthStore } = await import('../store/authStore')
  const removed = new Set(trackIds)
  useAuthStore
    .getState()
    .setCloudAudioTrackIds(
      useAuthStore.getState().cloudAudioTrackIds.filter((id) => !removed.has(id)),
    )
}

export async function syncCloudAfterTracksRemoved(trackIds: string[]): Promise<void> {
  const { useAuthStore } = await import('../store/authStore')
  const token = useAuthStore.getState().token
  if (!token) return
  await purgeTracksFromCloud(token, trackIds)
  await flushCloudPush(token)
}

export function scheduleCloudPush(_reason?: string): void {
  void import('../store/authStore').then(({ useAuthStore }) => {
    if (!useAuthStore.getState().token) return
    if (pushTimer != null) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      const token = useAuthStore.getState().token
      if (!token) return
      void pushCloudState(token)
        .then(() => refreshAuthStorage())
        .catch((e) => {
          console.warn('[cloud] push:', e)
        })
    }, 1800)
  })
}

export async function pushCloudState(token: string): Promise<void> {
  const settings: AppSettings = {
    libraryView: useSettingsStore.getState().libraryView,
    karaokeOnLyricsLoaded: useSettingsStore.getState().karaokeOnLyricsLoaded,