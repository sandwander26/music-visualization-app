import { create } from 'zustand'
import * as mm from 'music-metadata-browser'
import { analyzeMeyda, type TrackFeatures } from '../audio/meydaAnalyzer'
import { computeMoodWeights, type MoodWeights } from '../audio/moodEngine'
import {
  saveTrackFiles,
  saveCoverBlob,
  deleteTrackFiles,
  loadLibraryManifest,
  saveLibraryManifest,
  loadCoverObjectUrl,
  loadTrackBytes,
  isPersistenceAvailable,
  type PersistedTrack,
} from '../library/persistence'
import { mergeTrackDisplayFromFilename } from '../utils/filenameMeta'
import { isPendingAudioPath } from '../utils/trackCloud'
import { audioEngine } from '../audio/audioEngine'
import {
  resolveCoverBlobUrl,
  resolveAlbumArtBlobUrl,
  albumsLikelySame,
} from '../services/itunesCover'
import { useAudioStore } from './audioStore'

export interface LibraryTrack {
  id: string
  file?: File
  
  originalFileName: string | null
  name: string
  artist: string
  album: string
  cover: string | null
  duration: number
  addedAt: number
  audioPath: string | null
  coverPath: string | null
  
  sourceFileSize?: number | null
  features?: TrackFeatures
  moodWeights?: MoodWeights
  isAnalyzing?: boolean
  analyzeFailed?: boolean
}

export interface AddTrackResult {
  track: LibraryTrack
  
  added: boolean
  
  linkedCloudSlot?: boolean
}

interface LibraryStore {
  tracks: LibraryTrack[]
  currentTrackId: string | null
  isLoadingFromDisk: boolean
  addTrack: (file: File) => Promise<AddTrackResult>
  removeTrack: (id: string) => Promise<void>
  removeTracks: (ids: string[]) => Promise<void>
  clearAll: () => Promise<void>
  setCurrentTrack: (id: string | null) => void
  setTrackFeatures: (trackId: string, features: TrackFeatures) => void
  loadLibraryFromDisk: () => Promise<void>
  persistManifest: () => Promise<void>
  getNextTrack: () => LibraryTrack | null
  getPrevTrack: () => LibraryTrack | null
  applyEnrichedCover: (trackId: string, coverUrl: string) => void
  
  syncTrackDisplayFromAudio: (trackId?: string | null) => void
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

interface ParsedMetadata {
  title: string
  artist: string
  album: string
  duration: number
  coverBlob: Blob | null
  coverObjectUrl: string | null
}

async function parseFileMetadata(file: File): Promise<ParsedMetadata> {
  const fallbackName = file.name.replace(/\.[^/.]+$/, '')
  let title = fallbackName
  let artist = 'Unknown'
  let album = ''
  let duration = 0
  let coverBlob: Blob | null = null
  let coverObjectUrl: string | null = null

  try {
    const metadata = await mm.parseBlob(file)
    if (metadata.common.title) title = metadata.common.title
    if (metadata.common.artist) artist = metadata.common.artist
    if (metadata.common.album) album = metadata.common.album
    if (metadata.format.duration) duration = metadata.format.duration
    const picture = metadata.common.picture?.[0]
    if (picture) {
      coverBlob = new Blob([picture.data as BlobPart], { type: picture.format })
      coverObjectUrl = URL.createObjectURL(coverBlob)
    }
  } catch {
  }

  return { title, artist, album, duration, coverBlob, coverObjectUrl }
}

function normOrigFileName(name: string): string {
  return name.trim().toLowerCase()
}

interface MergedDisplayMeta {
  title: string
  artist: string
  album: string
  cover: string
}

function findCloudOnlySlot(
  tracks: LibraryTrack[],
  file: File,
): LibraryTrack | undefined {
  const fn = normOrigFileName(file.name)
  return tracks.find((t) => {
    if (!isPendingAudioPath(t.audioPath)) return false
    if (!t.originalFileName) return false
    if (normOrigFileName(t.originalFileName) !== fn) return false
    const sz = t.sourceFileSize
    return sz == null || sz === file.size
  })
}

function findExistingSameUpload(
  tracks: LibraryTrack[],
  file: File,
  meta: ParsedMetadata,
  merged: MergedDisplayMeta,
): LibraryTrack | undefined {
  const fn = normOrigFileName(file.name)

  const live = tracks.find((t) => t.file && t.file.name === file.name && t.file.size === file.size)
  if (live) return live

  const byNameSize = tracks.find((t) => {
    if (normOrigFileName(t.originalFileName ?? '') !== fn) return false
    const sz = t.sourceFileSize ?? t.file?.size
    return sz != null && sz === file.size
  })
  if (byNameSize) return byNameSize

  const byNameDuration = tracks.find((t) => {
    if (normOrigFileName(t.originalFileName ?? '') !== fn) return false
    const sz = t.sourceFileSize ?? t.file?.size
    if (sz != null) return false
    return Math.abs(t.duration - meta.duration) < 0.5
  })
  if (byNameDuration) return byNameDuration

  return tracks.find(
    (t) =>
      t.name === merged.title &&
      t.artist === merged.artist &&
      Math.abs(t.duration - meta.duration) < 0.5,
  )
}

function trackToPersisted(t: LibraryTrack): PersistedTrack {
  return {
    id: t.id,
    title: t.name,
    artist: t.artist,
    album: t.album,
    originalFileName: t.originalFileName ?? null,
    sourceFileSize: t.sourceFileSize ?? null,
    audioPath: t.audioPath ?? '',
    coverPath: t.coverPath,
    features: t.features ?? null,
    moodWeights: t.moodWeights ?? null,
    addedAt: new Date(t.addedAt).toISOString(),
    durationSec: t.duration,
  }
}

async function saveManifestToDisk(): Promise<void> {
  if (!isPersistenceAvailable()) return
  const all = useLibraryStore.getState().tracks
  const valid = all.filter((t) => t.audioPath !== null)
  await saveLibraryManifest(valid.map(trackToPersisted))
}

async function persistCurrentManifest(): Promise<void> {
  try {
    await saveManifestToDisk()
    const { scheduleCloudPush } = await import('../services/cloudSync')
    scheduleCloudPush('library')
  } catch (err) {
    console.warn('[library] не удалось сохранить манифест:', err)
  }
}

async function persistAfterTracksRemoved(removedIds: string[]): Promise<void> {
  try {
    await saveManifestToDisk()
  } catch (err) {
    console.warn('[library] не удалось сохранить манифест:', err)
  }
  const { syncCloudAfterTracksRemoved } = await import('../services/cloudSync')
  void syncCloudAfterTracksRemoved(removedIds).catch((err) => {
    console.warn('[library] облако после удаления:', err)
  })
}

let analyzeChain: Promise<void> = Promise.resolve()

function enqueueAnalysis(trackId: string): void {
  analyzeChain = analyzeChain.then(async () => {
    const exists = useLibraryStore.getState().tracks.find((t) => t.id === trackId)
    if (!exists) return
    if (exists.features) return

    useLibraryStore.setState((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, isAnalyzing: true } : t)),
    }))

    let ctx: AudioContext | null = null
    try {
      const arrayBuf = await readTrackArrayBuffer(exists)