import { makeTrackLyricsKey } from '../utils/trackLyricsKey'

const PREFIX = 'mv_lrc_v1_'
const MAX_ENTRIES = 160

interface Payload {
  trackKey: string
  raw: string
  savedAt: number
  
  catalogArtist?: string
  catalogTitle?: string
}

export interface LyricsDiskCacheEntry {
  raw: string
  catalogArtist?: string
  catalogTitle?: string
}

function fnv1aHex(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function storageKey(trackKey: string): string {
  return PREFIX + fnv1aHex(trackKey)
}

function parsePayload(raw: string): Payload | null {
  try {
    const o = JSON.parse(raw) as Payload
    if (typeof o.trackKey !== 'string' || typeof o.raw !== 'string' || typeof o.savedAt !== 'number')
      return null
    return o
  } catch {
    return null
  }
}

function readPayload(fileName: string, byteSize: number): Payload | null {
  const trackKey = makeTrackLyricsKey(fileName, byteSize)
  const raw = localStorage.getItem(storageKey(trackKey))
  if (!raw) return null
  const p = parsePayload(raw)
  if (!p || p.trackKey !== trackKey) return null
  return p
}

function evictIfNeeded(): void {
  const entries: { lsKey: string; savedAt: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const lsKey = localStorage.key(i)
    if (!lsKey?.startsWith(PREFIX)) continue
    const p = parsePayload(localStorage.getItem(lsKey) ?? '')
    if (p) entries.push({ lsKey, savedAt: p.savedAt })
  }
  if (entries.length <= MAX_ENTRIES) return
  entries.sort((a, b) => a.savedAt - b.savedAt)
  const drop = entries.length - MAX_ENTRIES
  for (let j = 0; j < drop; j++) localStorage.removeItem(entries[j].lsKey)
}

export function readLyricsDiskCache(fileName: string, byteSize: number): LyricsDiskCacheEntry | null {
  const p = readPayload(fileName, byteSize)
  if (!p) return null
  const entry: LyricsDiskCacheEntry = { raw: p.raw }
  if (typeof p.catalogArtist === 'string' && p.catalogArtist.trim()) entry.catalogArtist = p.catalogArtist.trim()
  if (typeof p.catalogTitle === 'string' && p.catalogTitle.trim()) entry.catalogTitle = p.catalogTitle.trim()
  return entry
}

export function clearLyricsDiskCache(fileName: string, byteSize: number): void {
  const trackKey = makeTrackLyricsKey(fileName, byteSize)
  try {
    localStorage.removeItem(storageKey(trackKey))
  } catch {
    
  }
}

export function writeLyricsDiskCache(
  fileName: string,
  byteSize: number,
  raw: string,
  catalog?: { catalogArtist?: string; catalogTitle?: string },
): void {
  if (!raw.trim()) return
  const trackKey = makeTrackLyricsKey(fileName, byteSize)
  const prev = readPayload(fileName, byteSize)
  const ca = catalog?.catalogArtist?.trim()
  const ct = catalog?.catalogTitle?.trim()
  const payload: Payload = {
    trackKey,
    raw,
    savedAt: Date.now(),
    ...(ca ? { catalogArtist: ca } : prev?.catalogArtist ? { catalogArtist: prev.catalogArtist } : {}),
    ...(ct ? { catalogTitle: ct } : prev?.catalogTitle ? { catalogTitle: prev.catalogTitle } : {}),
  }
  try {
    localStorage.setItem(storageKey(trackKey), JSON.stringify(payload))
    evictIfNeeded()
    void import('./cloudSync').then((m) => m.scheduleCloudPush('lrc'))
  } catch {
    
  }
}
