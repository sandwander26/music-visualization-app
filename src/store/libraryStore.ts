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
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      const audioBuffer = await ctx.decodeAudioData(arrayBuf)
      const features = await analyzeMeyda(audioBuffer)
      const moodWeights = computeMoodWeights(features)
      useLibraryStore.setState((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId
            ? { ...t, features, moodWeights, isAnalyzing: false, analyzeFailed: false }
            : t,
        ),
      }))
      void persistCurrentManifest()
    } catch (err) {
      console.warn('[library] анализ упал для', exists.name, err)
      useLibraryStore.setState((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, isAnalyzing: false, analyzeFailed: true } : t,
        ),
      }))
    } finally {
      if (ctx) {
        try { await ctx.close() } catch { /* ignore */ }
      }
    }
  })
}

async function readTrackArrayBuffer(track: LibraryTrack): Promise<ArrayBuffer> {
  if (track.file) return await track.file.arrayBuffer()
  if (track.audioPath && isPersistenceAvailable()) {
    const bytes = await loadTrackBytes(track.audioPath)
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }
  throw new Error('Трек не имеет источника аудио')
}

function normAlbumKeyPart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function pickAlbumCoverDonor(tracks: LibraryTrack[], artist: string, album: string): LibraryTrack | undefined {
  const na = normAlbumKeyPart(artist)
  const nb = normAlbumKeyPart(album)
  if (!na || !nb) return undefined
  const group = tracks.filter(
    (t) => t.cover && normAlbumKeyPart(t.artist) === na && normAlbumKeyPart(t.album) === nb,
  )
  if (group.length === 0) return undefined
  const withPath = group.filter((t) => t.coverPath).sort((a, b) => a.addedAt - b.addedAt)
  if (withPath.length > 0) return withPath[0]
  return [...group].sort((a, b) => a.addedAt - b.addedAt)[0]
}

async function cloneCoverFromDonorToTrack(trackId: string, donor: LibraryTrack): Promise<boolean> {
  if (!donor.cover || donor.id === trackId) return false
  try {
    const blob = await fetch(donor.cover).then((r) => r.blob())
    if (!blob.size) return false
    const url = URL.createObjectURL(blob)
    useLibraryStore.getState().applyEnrichedCover(trackId, url)
    return true
  } catch {
    return false
  }
}

function reconcileAlbumArtForTrack(trackId: string): void {
  const { tracks } = useLibraryStore.getState()
  const tr = tracks.find((t) => t.id === trackId)
  if (!tr) return
  const art = tr.artist.trim()
  const alb = tr.album.trim()
  if (!art || !alb) return

  if (tr.coverPath && tr.cover) return

  const donor = pickAlbumCoverDonor(tracks, art, alb)
  if (!donor || donor.id === trackId || !donor.cover) return

  if (!tr.cover) {
    void cloneCoverFromDonorToTrack(trackId, donor)
    return
  }

  if (!tr.coverPath && donor.coverPath) {
    void cloneCoverFromDonorToTrack(trackId, donor)
  }
}

let unifyAlbumCoversTimer: ReturnType<typeof setTimeout> | null = null

function queueUnifyAlbumCoversInLibrary(): void {
  if (unifyAlbumCoversTimer != null) clearTimeout(unifyAlbumCoversTimer)
  unifyAlbumCoversTimer = setTimeout(() => {
    unifyAlbumCoversTimer = null
    void unifyAlbumCoversInLibraryInner()
  }, 420)
}

function groupTracksByArtistAndLooseAlbum(tracks: LibraryTrack[]): LibraryTrack[][] {
  const byArtist = new Map<string, LibraryTrack[]>()
  for (const t of tracks) {
    const ka = normAlbumKeyPart(t.artist)
    if (!ka) continue
    if (!byArtist.has(ka)) byArtist.set(ka, [])
    byArtist.get(ka)!.push(t)
  }
  const result: LibraryTrack[][] = []
  for (const [, arr] of byArtist) {
    if (arr.length < 2) continue
    const nonEmpty = arr.map((t) => t.album.trim()).filter(Boolean)
    if (nonEmpty.length === 0) continue
    const canonAlbum = [...nonEmpty].sort((a, b) => b.length - a.length)[0]
    const cluster = arr.filter(
      (t) =>
        !t.album.trim() ||
        normAlbumKeyPart(t.album) === normAlbumKeyPart(canonAlbum) ||
        albumsLikelySame(t.album, canonAlbum),
    )
    if (cluster.length >= 2) result.push(cluster)
  }
  return result
}

async function unifyAlbumCoversInLibraryInner(): Promise<void> {
  const tracks = useLibraryStore.getState().tracks
  const groups = groupTracksByArtistAndLooseAlbum(tracks)
  for (const members of groups) {
    if (members.length < 2) continue

    const canonAlbum =
      members.map((m) => m.album.trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? ''
    const artist = members[0].artist.trim()
    if (!canonAlbum || !artist) continue

    const urls = members.map((m) => m.cover).filter(Boolean) as string[]
    const unique = new Set(urls)
    const someMissing = members.some((m) => !m.cover)
    if (!someMissing && unique.size <= 1) continue

    const tmpUrl = await resolveAlbumArtBlobUrl({ artist, album: canonAlbum })
    if (!tmpUrl) {
      for (const m of members) reconcileAlbumArtForTrack(m.id)
      continue
    }

    let blob: Blob
    try {
      blob = await fetch(tmpUrl).then((r) => r.blob())
    } catch {
      URL.revokeObjectURL(tmpUrl)
      for (const m of members) reconcileAlbumArtForTrack(m.id)
      continue
    }
    URL.revokeObjectURL(tmpUrl)
    if (!blob.size) continue

    for (const m of members) {
      const url = URL.createObjectURL(blob)
      useLibraryStore.getState().applyEnrichedCover(m.id, url)
    }
  }
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tracks: [],
  currentTrackId: null,
  isLoadingFromDisk: false,

  addTrack: async (file) => {
    const meta = await parseFileMetadata(file)
    const mergedDisplay = mergeTrackDisplayFromFilename(file.name, {
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      cover: '',
    })

    const dup = findExistingSameUpload(get().tracks, file, meta, mergedDisplay)
    if (dup) {
      if (meta.coverObjectUrl) URL.revokeObjectURL(meta.coverObjectUrl)
      return { track: dup, added: false }
    }

    const cloudSlot = findCloudOnlySlot(get().tracks, file)
    const id = cloudSlot?.id ?? makeId()

    let audioPath: string | null = null
    let coverPath: string | null = cloudSlot?.coverPath ?? null
    if (isPersistenceAvailable()) {
      try {
        const saved = await saveTrackFiles(file, meta.coverBlob, id)
        audioPath = saved.audioPath
        if (!cloudSlot?.coverPath) coverPath = saved.coverPath
      } catch (err) {