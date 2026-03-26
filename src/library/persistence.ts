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