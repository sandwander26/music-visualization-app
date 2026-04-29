

interface LrclibTrack {
  duration?: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
  trackName?: string
  artistName?: string
}

export type LrclibFetchResult =
  | { status: 'ok'; text: string }
  | { status: 'none' }
  | { status: 'network' }

function shortenArtist(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  const cut = s.split(/\b(?:feat\.?|ft\.?|featuring)\b/i)[0]
  return cut?.trim() ?? s
}

function simplifyTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function hasLrcTimestamps(text: string): boolean {
  return /\[\d{1,2}:\d{2}/.test(text)
}

function pickLyricsFromTrack(t: LrclibTrack): string | null {
  const sync = t.syncedLyrics?.trim()
  if (sync && hasLrcTimestamps(sync)) return sync
  const plain = t.plainLyrics?.trim()
  if (plain && hasLrcTimestamps(plain)) return plain
  return null
}

async function httpGet(url: string): Promise<Response | null> {
  try {
    return await fetch(url)
  } catch {
    return null
  }
}

const GET_CACHED_MEMO_MAX = 160
const SEARCH_SYNC_MEMO_MAX = 48

const getCachedMemo = new Map<string, LrclibTrack | null>()
const searchSyncMemo = new Map<
  string,
  | { status: 'ok'; items: LrclibCandidate[] }
  | { status: 'none' }
  | { status: 'network' }
>()

function memoTrimOldest<K, V>(map: Map<K, V>, max: number) {
  while (map.size > max) {
    const k = map.keys().next().value
    if (k === undefined) break
    map.delete(k)
  }
}

export async function fetchGetCachedTrackRecord(params: {
  artist: string
  title: string
  album: string
  durationSec: number
}): Promise<LrclibTrack | null> {
  const a = params.artist.trim()
  const t = params.title.trim()
  const al = params.album.trim()
  const d = Math.round(params.durationSec)
  if (!a || !t || !al || d <= 0) return null

  const memoKey = `${a}\x1e${t}\x1e${al}\x1e${d}`
  if (getCachedMemo.has(memoKey)) return getCachedMemo.get(memoKey)!

  const url =
    `https://lrclib.net/api/get-cached?artist_name=${encodeURIComponent(a)}` +
    `&track_name=${encodeURIComponent(t)}&album_name=${encodeURIComponent(al)}&duration=${d}`

  const res = await httpGet(url)
  let out: LrclibTrack | null = null
  if (!res || res.status === 404) out = null
  else if (!res.ok) out = null
  else {
    try {
      const data = (await res.json()) as LrclibTrack
      out = typeof data === 'object' && data != null ? data : null
    } catch {
      out = null
    }
  }

  getCachedMemo.set(memoKey, out)
  memoTrimOldest(getCachedMemo, GET_CACHED_MEMO_MAX)
  return out
}

async function trySearchQueries(queries: string[], durationSec?: number): Promise<string | null> {
  for (const qRaw of queries) {
    const q = qRaw.trim()
    if (!q) continue
    const res = await httpGet(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`)
    if (!res) return null
    if (!res.ok) continue

    let arr: LrclibTrack[]
    try {
      const data = await res.json()
      arr = Array.isArray(data) ? data : []
    } catch {
      continue
    }

    const withSync = arr.filter((item) => pickLyricsFromTrack(item))
    const pool = withSync.length > 0 ? withSync : arr

    let ranked = [...pool]
    const dur = durationSec
    if (dur != null && dur > 0) {
      const target = Math.round(dur)
      ranked.sort((a, b) => {
        const da =
          a.duration != null ? Math.abs(Math.round(Number(a.duration)) - target) : 99999
        const db =
          b.duration != null ? Math.abs(Math.round(Number(b.duration)) - target) : 99999
        return da - db
      })
    }

    for (const item of ranked) {
      const lyrics = pickLyricsFromTrack(item)
      if (lyrics) return lyrics
    }
  }
  return null
}

export async function fetchSyncedLyricsFromLrclib(params: {
  artist: string
  title: string
  album?: string
  durationSec?: number
}): Promise<LrclibFetchResult> {
  const title = simplifyTitle(params.title)
  if (!title) return { status: 'none' }

  const artistFull = params.artist.trim()
  const artistShort = shortenArtist(artistFull)
  const album = params.album?.trim()
  const dur = params.durationSec

  const titlesToTry = Array.from(
    new Set(