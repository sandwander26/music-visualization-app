

interface ItunesSongResult {
  artistName?: string
  trackName?: string
  trackTimeMillis?: number
  artworkUrl100?: string
  artworkUrl60?: string
}

interface ItunesSearchResponse {
  results?: ItunesSongResult[]
}

interface ItunesAlbumResult {
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  artworkUrl60?: string
}

const inflightCover = new Map<string, Promise<string | null>>()
const inflightAlbumArt = new Map<string, Promise<string | null>>()

function artworkToLarge(url: string): string {
  return url
    .replace(/100x100bb\.jpg/i, '600x600bb.jpg')
    .replace(/60x60bb\.jpg/i, '600x600bb.jpg')
}

function coverDedupeKey(artist: string, title: string, durationSec?: number): string {
  const ms =
    durationSec != null && durationSec > 0 ? String(Math.round(durationSec * 1000)) : ''
  return `${artist.trim().toLowerCase()}\x00${title.trim().toLowerCase()}\x00${ms}`
}

async function fetchItunesSongResults(termEncoded: string): Promise<ItunesSongResult[]> {
  let res: Response
  try {
    res = await fetch(
      `https://itunes.apple.com/search?term=${termEncoded}&entity=song&limit=16&media=music`,
      { headers: { Accept: 'application/json' } },
    )
  } catch {
    return []
  }
  if (!res.ok) return []
  let data: ItunesSearchResponse
  try {
    data = (await res.json()) as ItunesSearchResponse
  } catch {
    return []
  }
  const raw = data.results
  return Array.isArray(raw) ? raw : []
}

async function resolveCoverBlobUrlInner(params: {
  artist: string
  title: string
  durationSec?: number
}): Promise<string | null> {
  const title = params.title.trim()
  if (!title) return null
  const artist = params.artist.trim()

  let raw = await fetchItunesSongResults(encodeURIComponent(artist ? `${artist} ${title}` : title))
  if (raw.length === 0 && artist) {
    raw = await fetchItunesSongResults(encodeURIComponent(`${title} ${artist}`))
  }
  if (raw.length === 0 && artist) {
    raw = await fetchItunesSongResults(encodeURIComponent(title))
  }

  if (raw.length === 0) return null

  const durMs =
    params.durationSec != null && params.durationSec > 0
      ? Math.round(params.durationSec * 1000)
      : null

  const titleWords = normTokens(title)
  const shortTitle = titleWords.length <= 2

  type Scored = { r: ItunesSongResult; score: number }
  const scored: Scored[] = []

  for (const r of raw) {
    const tn = r.trackName ?? ''
    const an = r.artistName ?? ''
    const titleOv = tokenOverlap(title, tn)
    const artistOv = artist ? tokenOverlap(artist, an) : 0.55
    if (artist && artistOv < 0.22) continue
    if (titleOv < 0.38) continue

    let durBoost = 0
    if (durMs != null && r.trackTimeMillis != null) {
      const diff = Math.abs(r.trackTimeMillis - durMs)
      if (diff <= 2500) durBoost = 0.22
      else if (diff <= 8000) durBoost = 0.12
      else if (diff <= 15000) durBoost = 0.04
      else if (shortTitle) continue
    } else if (shortTitle && durMs != null && r.trackTimeMillis != null) {
      const diff = Math.abs(r.trackTimeMillis - durMs)
      if (diff > 6000) continue
    }

    let score = titleOv * 0.56 + artistOv * 0.34 + durBoost
    if (normCollapse(title) === normCollapse(tn)) score += 0.12
    if (artist && normCollapse(artist) === normCollapse(an)) score += 0.1
    scored.push({ r, score })
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score < 0.62) return null

  const pick = best.r
  const art = pick.artworkUrl100 ?? pick.artworkUrl60
  if (!art) return null

  try {
    const imgRes = await fetch(artworkToLarge(art), { headers: { Accept: 'image/*' } })
    if (!imgRes.ok) return null
    const blob = await imgRes.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export function albumsLikelySame(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (!x || !y) return false
  if (normCollapse(x) === normCollapse(y)) return true
  return tokenOverlap(x, y) >= 0.42
}

function normCollapse(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring)\b.+$/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normTokens(s: string): string[] {
  const c = normCollapse(s)
  return c.split(/\s+/).filter((w) => w.length >= 2)
}

function tokenOverlap(a: string, b: string): number {
  const ta = normTokens(a)
  const tb = new Set(normTokens(b))
  if (ta.length === 0) return tb.size === 0 ? 1 : 0
  let hit = 0
  for (const w of ta) if (tb.has(w)) hit++
  const pa = hit / ta.length
  const pb = tb.size > 0 ? hit / tb.size : 0
  return Math.min(1, Math.max(pa, pb) * 0.85 + Math.min(pa, pb) * 0.15)
}

async function fetchItunesAlbumResults(termEncoded: string): Promise<ItunesAlbumResult[]> {
  let res: Response
  try {
    res = await fetch(
      `https://itunes.apple.com/search?term=${termEncoded}&entity=album&limit=24&media=music`,
      { headers: { Accept: 'application/json' } },
    )
  } catch {
    return []
  }
  if (!res.ok) return []
  let data: { results?: ItunesAlbumResult[] }
  try {
    data = (await res.json()) as { results?: ItunesAlbumResult[] }
  } catch {
    return []
  }
  const raw = data.results
  return Array.isArray(raw) ? raw : []
}

async function resolveAlbumArtBlobUrlInner(params: {
  artist: string
  album: string
}): Promise<string | null> {
  const artist = params.artist.trim()
  const album = params.album.trim()
  if (!artist || !album) return null

  let raw = await fetchItunesAlbumResults(encodeURIComponent(`${artist} ${album}`))
  if (raw.length === 0) {
    raw = await fetchItunesAlbumResults(encodeURIComponent(album))
  }
  if (raw.length === 0) return null

  type Scored = { r: ItunesAlbumResult; score: number }
  const scored: Scored[] = []

  for (const r of raw) {
    const cn = r.collectionName ?? ''
    const an = r.artistName ?? ''
    const artistOv = tokenOverlap(artist, an)
    const albumOv = tokenOverlap(album, cn)
    if (artistOv < 0.18) continue
    if (albumOv < 0.32) continue

    let score = artistOv * 0.42 + albumOv * 0.52
    if (normCollapse(album) === normCollapse(cn)) score += 0.14
    if (normCollapse(artist) === normCollapse(an)) score += 0.08
    scored.push({ r, score })
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score < 0.52) return null

  const art = best.r.artworkUrl100 ?? best.r.artworkUrl60
  if (!art) return null

  try {
    const imgRes = await fetch(artworkToLarge(art), { headers: { Accept: 'image/*' } })
    if (!imgRes.ok) return null
    const blob = await imgRes.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export async function resolveAlbumArtBlobUrl(params: {
  artist: string
  album: string
}): Promise<string | null> {
  const artist = params.artist.trim()
  const album = params.album.trim()
  if (!artist || !album) return null
  const key = `${artist.toLowerCase()}\x00${album.toLowerCase()}`

  const pending = inflightAlbumArt.get(key)
  if (pending) return pending

  const p = resolveAlbumArtBlobUrlInner(params).finally(() => {
    inflightAlbumArt.delete(key)
  })
  inflightAlbumArt.set(key, p)
  return p
}

export async function resolveCoverBlobUrl(params: {
  artist: string
  title: string
  durationSec?: number
}): Promise<string | null> {
  const title = params.title.trim()
  if (!title) return null
  const artist = params.artist.trim()
  const key = coverDedupeKey(artist, title, params.durationSec)

  const pending = inflightCover.get(key)
  if (pending) return pending

  const p = resolveCoverBlobUrlInner(params).finally(() => {
    inflightCover.delete(key)
  })
  inflightCover.set(key, p)
  return p
}
