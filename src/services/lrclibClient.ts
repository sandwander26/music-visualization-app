

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
      [title, title.replace(/\s*[\u2013\u2014-]\s*.*$/, '').trim()].filter(
        (x) => x.length > 0,
      ),
    ),
  )

  let sawNetworkError = false

  for (const tt of titlesToTry) {
    const variants: { artist?: string; useDur: boolean }[] = []
    if (artistFull) {
      variants.push({ artist: artistFull, useDur: true })
      variants.push({ artist: artistFull, useDur: false })
      if (artistShort && artistShort !== artistFull) {
        variants.push({ artist: artistShort, useDur: true })
        variants.push({ artist: artistShort, useDur: false })
      }
    } else {
      variants.push({ useDur: true })
      variants.push({ useDur: false })
    }

    for (const v of variants) {
      const qs = new URLSearchParams()
      qs.set('track_name', tt)
      if (v.artist?.trim()) qs.set('artist_name', v.artist.trim())
      if (album) qs.set('album_name', album)
      if (v.useDur && dur != null && dur > 0) {
        qs.set('duration', String(Math.round(dur)))
      }

      const res = await httpGet(`https://lrclib.net/api/get?${qs.toString()}`)
      if (res === null) {
        sawNetworkError = true
        break
      }
      if (!res.ok) continue

      try {
        const data = (await res.json()) as LrclibTrack
        const lyrics = pickLyricsFromTrack(data)
        if (lyrics) return { status: 'ok', text: lyrics }
      } catch {
        sawNetworkError = true
        break
      }
    }
    if (sawNetworkError) break
  }

  if (sawNetworkError) return { status: 'network' }

  const searchQueries: string[] = []
  if (artistFull) {
    searchQueries.push(`${artistFull} ${title}`)
    if (artistShort !== artistFull) searchQueries.push(`${artistShort} ${title}`)
  }
  searchQueries.push(title)

  const probe = await httpGet(
    `https://lrclib.net/api/search?q=${encodeURIComponent(searchQueries[0] ?? title)}`,
  )
  if (probe === null) return { status: 'network' }

  const fromSearch = await trySearchQueries(searchQueries, dur)
  if (fromSearch) return { status: 'ok', text: fromSearch }

  return { status: 'none' }
}

export interface LrclibCandidate {
  label: string
  syncedText: string
  durationSec?: number
  artistName?: string
  trackName?: string
}

export function catalogLabelsFromCandidate(c: LrclibCandidate): {
  artist?: string
  title?: string
} {
  let artist = c.artistName?.trim()
  let title = c.trackName?.trim()
  if (artist && title) return { artist, title }

  let rest = c.label.trim()
  const durSuffix = rest.match(/\s*·\s*\d+(?:\.\d+)?\s*с\s*$/i)
  if (durSuffix != null && durSuffix.index != null) rest = rest.slice(0, durSuffix.index).trim()

  const m = rest.match(/^(.+?)\s*[—–\-]\s*(.+)$/)
  if (m) {
    if (!artist) artist = m[1].trim()
    if (!title) title = m[2].trim()
  }
  return {
    artist: artist || undefined,
    title: title || undefined,
  }
}

function trackRecordToSyncedCandidate(item: LrclibTrack): LrclibCandidate | null {
  const text = pickLyricsFromTrack(item)
  if (!text) return null
  const dur =
    item.duration != null && !Number.isNaN(Number(item.duration))
      ? Number(item.duration)
      : undefined
  const labelBase = `${item.artistName ?? '?'} — ${item.trackName ?? '?'}`
  const label =
    dur != null ? `${labelBase} · ${Math.round(dur)} с` : labelBase
  return {
    label,
    syncedText: text,
    durationSec: dur,
    artistName: item.artistName ?? undefined,
    trackName: item.trackName ?? undefined,
  }
}

export async function fetchGetCachedSyncedCandidate(params: {
  artist: string
  title: string
  album: string
  durationSec: number
}): Promise<LrclibCandidate | null> {
  const rec = await fetchGetCachedTrackRecord(params)
  if (!rec) return null
  return trackRecordToSyncedCandidate(rec)
}

function normLite(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sharedTokenHits(a: string, b: string): number {
  const ta = normLite(a).split(' ').filter((w) => w.length > 2)
  const tb = new Set(normLite(b).split(' ').filter((w) => w.length > 2))
  let n = 0
  for (const w of ta) if (tb.has(w)) n++
  return n
}

export interface LyricsMatchContext {
  durationSec?: number
  hintArtist: string
  hintTitle: string
  filenameArtist?: string
  filenameTitle?: string
  
  strictAutoPick?: boolean
}

function scoreLyricsCandidateInternal(c: LrclibCandidate, ctx: LyricsMatchContext): number {
  const dur = ctx.durationSec
  let score = 0

  if (dur != null && dur > 0 && c.durationSec != null) {
    score += Math.min(Math.abs(c.durationSec - dur), 200) * 1.4
  } else {
    score += 40
  }

  const ca = c.artistName ?? ''
  const ct = c.trackName ?? ''

  const pairs: [string, string][] = []
  if (ctx.filenameTitle?.trim())
    pairs.push([ctx.filenameArtist?.trim() ?? '', ctx.filenameTitle.trim()])
  pairs.push([ctx.hintArtist.trim(), ctx.hintTitle.trim()])

  let bonus = 0
  for (const [ha, ht] of pairs) {
    if (!ht) continue
    const st = sharedTokenHits(ht, ct)
    const sa = ha ? sharedTokenHits(ha, ca) : 0
    const nca = normLite(ct)
    const nth = normLite(ht)
    const sub = nca.includes(nth) || nth.includes(nca)
    bonus = Math.max(bonus, st * 12 + sa * 9 + (sub ? 38 : 0))
  }

  score -= bonus
  return score
}

function durationDeltaSec(c: LrclibCandidate, durationSec?: number): number | null {
  if (durationSec == null || durationSec <= 0 || c.durationSec == null) return null
  return Math.abs(Math.round(c.durationSec) - Math.round(durationSec))
}

export interface RankedLrclibCandidate extends LrclibCandidate {
  
  matchScore: number
  durationDeltaSec: number | null
  isRecommended: boolean
}

export function rankLyricsCandidates(
  items: LrclibCandidate[],
  ctx: LyricsMatchContext,
): RankedLrclibCandidate[] {
  if (items.length === 0) return []

  const scored = items.map((c) => ({
    c,
    internal: scoreLyricsCandidateInternal(c, ctx),
    durationDeltaSec: durationDeltaSec(c, ctx.durationSec),
  }))

  scored.sort((a, b) => a.internal - b.internal)

  const top = scored[0]
  const second = scored[1]
  const topIsConfident =
    top.internal <= 42 || (second != null && top.internal < second.internal - 10)

  return scored.map((row, index) => ({
    ...row.c,
    matchScore: Math.max(0, Math.min(100, Math.round(100 - row.internal))),
    durationDeltaSec: row.durationDeltaSec,
    isRecommended: index === 0 && topIsConfident,
  }))
}

export function pickBestLyricsCandidate(
  items: LrclibCandidate[],
  ctx: LyricsMatchContext,
): LrclibCandidate | null {
  if (items.length === 0) return null

  const ranked = rankLyricsCandidates(items, ctx)