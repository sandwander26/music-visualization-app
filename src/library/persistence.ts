import type { TrackFeatures } from '../audio/meydaAnalyzer'
import type { MoodWeights } from '../audio/moodEngine'
import { idbGet, idbSet, idbDel } from '../utils/idb'

const MANIFEST_KEY = 'library:manifest'
const audioKey = (id: string) => `track:${id}:audio`
const coverKey = (id: string) => `track:${id}:cover`

export interface PersistedTrack {
  id: string
  title: string
  artist: string
  album: string
  audioPath: string
  coverPath: string | null
  features: TrackFeatures | null
  moodWeights: MoodWeights | null
  addedAt: string
  durationSec: number
  originalFileName?: string | null
  sourceFileSize?: number | null
}

export async function ensureLibraryDirs(): Promise<void> {
}

export async function saveCoverBlob(coverBlob: Blob, trackId: string): Promise<string> {
  const path = coverKey(trackId)
  await idbSet(path, coverBlob)
  return path
}

export async function loadCoverBytes(coverPath: string): Promise<Uint8Array | null> {
  if (!isPersistenceAvailable()) return null
  const blob = await idbGet<Blob>(coverPath)
  if (!blob) return null
  return blobToBytes(blob)
}

export function isPersistenceAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

export async function saveTrackFiles(
  audioFile: File,
  coverBlob: Blob | null,
  trackId: string,
): Promise<{ audioPath: string; coverPath: string | null }> {
  const audioPath = audioKey(trackId)
  await idbSet(audioPath, audioFile)

  let coverPath: string | null = null
  if (coverBlob) {
    coverPath = coverKey(trackId)
    await idbSet(coverPath, coverBlob)
  }
  return { audioPath, coverPath }
}

function isValidPersistedTrack(v: unknown): v is PersistedTrack {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.artist === 'string' &&
    typeof o.audioPath === 'string' &&
    (typeof o.coverPath === 'string' || o.coverPath === null) &&
    (typeof o.addedAt === 'string' || typeof o.addedAt === 'number') &&
    typeof o.durationSec === 'number'
  )
}

export async function loadLibraryManifest(): Promise<PersistedTrack[]> {
  if (!isPersistenceAvailable()) return []
  try {
    const stored = await idbGet<PersistedTrack[]>(MANIFEST_KEY)
    if (!Array.isArray(stored)) return []
    const valid: PersistedTrack[] = []
    for (const entry of stored) {
      if (!isValidPersistedTrack(entry)) continue
      valid.push({
        ...entry,
        album: typeof entry.album === 'string' ? entry.album : '',
        features: entry.features ?? null,
        moodWeights: entry.moodWeights ?? null,
        addedAt:
          typeof entry.addedAt === 'string'
            ? entry.addedAt
            : new Date(Number(entry.addedAt)).toISOString(),
      })
    }
    return valid
  } catch (err) {
    console.warn('[persistence] чтение library manifest упало:', err)
    return []
  }
}

let writeChain: Promise<void> = Promise.resolve()

export async function saveLibraryManifest(tracks: PersistedTrack[]): Promise<void> {
  if (!isPersistenceAvailable()) return
  const job = async (): Promise<void> => {
    try {
      await idbSet(MANIFEST_KEY, tracks)
    } catch (err) {
      console.warn('[persistence] запись library manifest упала:', err)
      throw err
    }
  }
  writeChain = writeChain.then(job, job)
  return writeChain
}

export async function deleteTrackFiles(trackId: string): Promise<void> {
  if (!isPersistenceAvailable()) return
  await idbDel(audioKey(trackId))
  await idbDel(coverKey(trackId))
}

export async function loadTrackBytes(audioPath: string): Promise<Uint8Array> {
  if (!isPersistenceAvailable()) throw new Error('Persistence unavailable')
  const blob = await idbGet<Blob>(audioPath)
  if (!blob) throw new Error(`Аудио не найдено: ${audioPath}`)
  return blobToBytes(blob)
}

export async function loadCoverObjectUrl(coverPath: string): Promise<string> {
  if (!isPersistenceAvailable()) throw new Error('Persistence unavailable')
  const blob = await idbGet<Blob>(coverPath)
  if (!blob) throw new Error(`Обложка не найдена: ${coverPath}`)
  return URL.createObjectURL(blob)
}

export function audioMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'flac': return 'audio/flac'
    case 'wav': return 'audio/wav'
    case 'm4a': return 'audio/mp4'
    case 'aac': return 'audio/aac'
    case 'ogg': return 'audio/ogg'
    case 'opus': return 'audio/opus'
    default: return 'audio/mpeg'
  }
}
