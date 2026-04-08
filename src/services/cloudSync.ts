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
    autoSearchLyrics: useSettingsStore.getState().autoSearchLyrics,
    defaultVolume: useSettingsStore.getState().defaultVolume,
  }
  await putSettings(token, settings)

  const tracks = useLibraryStore.getState().tracks
  const items = tracks.map((t) => ({
    trackId: t.id,
    item: trackToCloudItem(t),
  }))
  await putLibrary(token, items)

  for (const t of tracks) {
    const fn = t.originalFileName
    const sz = t.sourceFileSize ?? t.file?.size
    if (fn && sz != null) {
      const cached = readLyricsDiskCache(fn, sz)
      if (cached?.raw) {
        await putTrackLrc(token, t.id, {
          lrcText: cached.raw,
          catalogArtist: cached.catalogArtist,
          catalogTitle: cached.catalogTitle,
        })
      }
    }

    try {
      let coverBytes: Uint8Array | null = null
      let mime = 'image/jpeg'
      if (t.coverPath) {
        coverBytes = await loadCoverBytes(t.coverPath)
        mime = t.coverPath.endsWith('.png')
          ? 'image/png'
          : t.coverPath.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg'
      } else if (t.cover?.startsWith('blob:') || t.cover?.startsWith('http')) {
        const blob = await fetch(t.cover).then((r) => r.blob())
        if (blob.size > 0) {
          coverBytes = new Uint8Array(await blob.arrayBuffer())
          mime = blob.type || 'image/jpeg'
        }
      }
      if (coverBytes && coverBytes.byteLength > 0) {
        await putTrackCover(token, t.id, mime, bytesToBase64(coverBytes))
      }
    } catch (err) {
      console.warn('[cloud] cover upload', t.id, err)
    }
  }

  const presetsPayload = readPresetsFromLocalStorage()
  await putPresets(token, presetsPayload)

  if (isUserVizPersistenceAvailable()) {
    const metas = await loadUserVizManifest()
    const items: UserVizCloudItem[] = []
    for (const m of metas) {
      if (!m.id.startsWith('user-')) continue
      try {
        const source = await readUserVizFile(m.sourcePath)
        items.push({
          vizId: m.id,
          name: m.name,
          moods: m.moods,
          source,
          createdAt: m.createdAt,
        })
      } catch (err) {
        console.warn('[cloud] user-viz upload', m.id, err)
      }
    }
    await putUserViz(token, items)
  }
}

export async function pullCloudSnapshot(token: string): Promise<void> {
  const snap = await fetchSnapshot(token)

  if (snap.settings?.json) {
    const s = snap.settings.json
    const local: AppSettings = {
      libraryView: s.libraryView === 'grid' ? 'grid' : 'list',
      karaokeOnLyricsLoaded: Boolean(s.karaokeOnLyricsLoaded),
      autoSearchLyrics: s.autoSearchLyrics !== false,
      defaultVolume: s.defaultVolume ?? 1,
    }
    useSettingsStore.setState(local)
    useUIStore.getState().setLibraryView(local.libraryView)
    try {
      window.localStorage.setItem('mv_app_settings_v1', JSON.stringify(local))
    } catch {
      /* ignore */
    }
  }

  if (snap.presets?.data) {
    const data = snap.presets.data
    writePresetsToLocalStorage({
      currentParams: (data.currentParams ?? {}) as ReturnType<
        typeof readPresetsFromLocalStorage
      >['currentParams'],
      savedPresets: Array.isArray(data.savedPresets)
        ? (data.savedPresets as ReturnType<typeof readPresetsFromLocalStorage>['savedPresets'])
        : [],
    })
    const hydrated = readPresetsFromLocalStorage()
    usePresetsStore.setState({
      currentParams: hydrated.currentParams,
      savedPresets: hydrated.savedPresets,
    })
  }

  if (isUserVizPersistenceAvailable() && Array.isArray(snap.userViz)) {
    await pullUserVizFromCloud(snap.userViz)
  }

  if (!isPersistenceAvailable()) return

  const localManifest = await loadLibraryManifest()
  const localById = new Map(localManifest.map((t) => [t.id, t]))
  const merged: PersistedTrack[] = []

  await ensureLibraryDirs()

  for (const row of snap.library) {
    const item = row.item
    let coverPath = localById.get(item.id)?.coverPath ?? null

    const coverRow = snap.covers.find((c) => c.trackId === item.id)
    if (coverRow?.dataBase64) {
      const ext = coverExtForMime(coverRow.mime)
      coverPath = `covers/${item.id}.${ext}`
      const bytes = base64ToBytes(coverRow.dataBase64)
      await idbSet(`cover:${item.id}`, bytes)
    }

    const local = localById.get(item.id)
    const entry = cloudItemToPersisted(item, coverPath)
    if (local?.audioPath && !local.audioPath.endsWith('.pending')) {
      entry.audioPath = local.audioPath
    }
    merged.push(entry)

    const lrcRow = snap.lrc.find((l) => l.trackId === item.id)
    if (lrcRow && item.originalFileName && item.sourceFileSize != null) {
      writeLyricsDiskCache(item.originalFileName, item.sourceFileSize, lrcRow.lrcText, {
        catalogArtist: lrcRow.catalogArtist,
        catalogTitle: lrcRow.catalogTitle,
      })
    }
  }

  for (const local of localManifest) {
    if (!merged.some((m) => m.id === local.id)) {
      merged.push(local)
    }
  }

  await saveLibraryManifest(merged)
  useAuthStore
    .getState()
    .setCloudAudioTrackIds(snap.cloudAudio.map((a) => a.trackId))
  await useLibraryStore.getState().loadLibraryFromDisk()
}

async function pullUserVizFromCloud(
  rows: {
    vizId: string
    name: string
    moods: string[]
    source: string
    createdAt: string
  }[],
): Promise<void> {
  await ensureUserVizDirs()
  const localMetas = await loadUserVizManifest()
  const merged: UserVisualizerMeta[] = []

  for (const row of rows) {
    const rel = `visualizers/${row.vizId}.tsx`
    await saveUserVizFile(row.vizId, row.source)
    merged.push({
      id: row.vizId,
      name: row.name,
      moods: row.moods.filter((m): m is MoodId =>
        ['energetic', 'upbeat', 'calm', 'sad', 'melancholic'].includes(m),
      ),
      sourcePath: rel,
      createdAt: row.createdAt,
    })
  }

  for (const local of localMetas) {
    if (!merged.some((m) => m.id === local.id)) {
      merged.push(local)
    }
  }

  await saveUserVizManifest(merged)

  const restored: UserVisualizerRuntime[] = []
  for (const m of merged) {
    let component = null
    let error: string | null = null
    try {
      const source = await readUserVizFile(m.sourcePath)
      const compiled = compileUserViz(source)
      component = compiled.component
      error = compiled.error
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    restored.push({ ...m, component, error, previewUrl: null })
  }
  useUserVizStore.setState({ visualizers: restored })
}
