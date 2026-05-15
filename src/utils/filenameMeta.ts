

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function stripSpamSegments(base: string): string {
  return collapseSpaces(
    base.replace(/\s*\([^)]*\.(?:cc|ru|net|org|com|io|tv|pw)[^)]*\)/gi, ''),
  )
}

function trimEdgeNoise(base: string): string {
  return collapseSpaces(base.replace(/^[_\s\-–—]+|[_\s\-–—]+$/g, ''))
}

function cleanSegment(s: string): string {
  const z = trimEdgeNoise(stripSpamSegments(s))
  return collapseSpaces(z.replace(/_/g, ' '))
}

export function parseArtistTitleFromFilename(fileName: string): {
  artist: string
  title: string
} | null {
  const rawBase = fileName.replace(/\.[^/.]+$/i, '').trim()
  if (!rawBase) return null

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBase.replace(/\s+/g, ''))
  ) {
    return null
  }

  const dotArtistTitle = rawBase.match(/\.\s*(.+?)\s*[-–—]\s*(.+)$/)
  if (dotArtistTitle) {
    const artist = cleanSegment(dotArtistTitle[1])
    const title = cleanSegment(dotArtistTitle[2])
    if (artist && title) return { artist, title }
  }

  const slugVk = rawBase.match(/^(.+?)_-_(.+)$/)
  if (slugVk) {
    const artist = cleanSegment(slugVk[1])
    const title = cleanSegment(slugVk[2])
    if (artist && title) return { artist, title }
  }

  const plain = rawBase.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (plain) {
    const artist = cleanSegment(plain[1])
    const title = cleanSegment(plain[2])
    if (artist && title) return { artist, title }
  }

  const pipe = rawBase.match(/^(.+?)\s*[|｜]\s*(.+)$/)
  if (pipe) {
    const artist = cleanSegment(pipe[1])
    const title = cleanSegment(pipe[2])
    if (artist && title) return { artist, title }
  }

  const stem = trimEdgeNoise(stripSpamSegments(rawBase))

  const du = stem.match(/^(.+?)__(.+)$/)
  if (du) {
    const artist = cleanSegment(du[1])
    const title = cleanSegment(du[2])
    if (artist && title) return { artist, title }
  }

  const usDash = stem.match(/^(.+?)_\s*[-–—]\s*(.+)$/)
  if (usDash) {
    const artist = cleanSegment(usDash[1])
    const title = cleanSegment(usDash[2])
    if (artist && title) return { artist, title }
  }

  const stemOnly = cleanSegment(rawBase)
  if (stemOnly.length >= 2) return { artist: '', title: stemOnly }

  return null
}

function normFold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sigTokens(s: string): string[] {
  return normFold(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
}

function tokenOverlapTitle(a: string, b: string): number {
  const ta = sigTokens(a)
  const tb = new Set(sigTokens(b))
  if (ta.length === 0) return tb.size === 0 ? 1 : 0
  let hit = 0
  for (const w of ta) if (tb.has(w)) hit++
  const pa = hit / ta.length
  const pb = tb.size > 0 ? hit / tb.size : 0
  return Math.min(1, Math.max(pa, pb) * 0.85 + Math.min(pa, pb) * 0.15)
}

export function catalogLabelsPlausibleForFile(
  sourceFileName: string | null | undefined,
  catalogArtist: string | undefined,
  catalogTitle: string | undefined,
): boolean {
  if (!sourceFileName?.trim()) return true
  const parsed = parseArtistTitleFromFilename(sourceFileName)
  if (!parsed) return true
  const pa = parsed.artist.trim()
  const pt = parsed.title.trim()
  if (!pa || !pt) return true

  const ca = catalogArtist?.trim() ?? ''
  const ct = catalogTitle?.trim() ?? ''
  if (!ca && !ct) return true

  const artistOv = tokenOverlapTitle(pa, ca)
  if (pa.length >= 2 && ca.length >= 2 && artistOv < 0.24) return false

  const ptoks = sigTokens(pt)
  const ctoks = sigTokens(ct)
  if (ptoks.length > 0 && ptoks.length <= 2 && ctoks.length > ptoks.length + 2) return false

  const titleOv = tokenOverlapTitle(pt, ct)
  if (titleOv < 0.36) return false

  return true
}

export function metadataWeakForAutoLyrics(opts: {
  tagArtist: string
  tagTitle: string
  sourceFileName: string | null
}): boolean {
  const ta = opts.tagArtist.trim()
  const tt = opts.tagTitle.trim()

  if (artistTitleLooksLikeFileSlug(tt) || artistTitleLooksLikeFileSlug(ta)) return true
  if (!tt) return true

  const parsed = opts.sourceFileName ? parseArtistTitleFromFilename(opts.sourceFileName) : null
  if (parsed?.artist && parsed?.title) {
    if (ta && tokenOverlapTitle(ta, parsed.artist) < 0.24) return true
    if (tt && tokenOverlapTitle(tt, parsed.title) < 0.24) return true
  }

  const toks = sigTokens(tt)
  if (toks.length <= 1 && tt.length >= 5) {
    const hasLatinWord = /[a-z]{3,}/i.test(tt)
    const hasCyrillicWord = /[\u0400-\u04FF]{4,}/.test(tt)
    if (!hasLatinWord && hasCyrillicWord) return true
  }

  if (ta.length >= 2 && ta.length <= 4 && tt.length >= 8 && tokenOverlapTitle(tt, ta) < 0.1) {
    return true
  }

  return false
}

export function filenameAsSearchHint(fileName: string): string {
  const stem = trimEdgeNoise(stripSpamSegments(fileName.replace(/\.[^/.]+$/i, '')))
  return collapseSpaces(stem.replace(/_/g, ' '))
}

export function buildLrclibSearchQueries(opts: {
  tagArtist: string
  tagTitle: string
  sourceFileName: string | null
}): string[] {
  const out: string[] = []
  const add = (s: string) => {
    const x = s.trim()
    if (x && !out.includes(x)) out.push(x)
  }

  const ta = opts.tagArtist.trim()
  const tt = opts.tagTitle.trim()

  const src = opts.sourceFileName
  if (src) {
    const parsed = parseArtistTitleFromFilename(src)
    if (parsed) {
      const pa = parsed.artist.trim()
      const pt = parsed.title.trim()
      if (pa && pt) {
        add(`${pa} ${pt}`)
        add(`${pa} - ${pt}`)
      }
      if (pt) add(pt)
      if (pa && pt)
        add(`${pa} ${pt.replace(/\s*\([^)]*\)\s*/g, ' ').trim()}`)
    }
    add(filenameAsSearchHint(src))
  }

  add(`${ta} ${tt}`)
  add(tt)
  if (ta) add(`${ta} - ${tt}`)

  return out
}

export function buildLrclibSearchQueriesFromTags(opts: {
  tagArtist: string
  tagTitle: string
  tagAlbum?: string
}): string[] {
  const out: string[] = []
  const add = (s: string) => {
    const x = s.trim()
    if (x && !out.includes(x)) out.push(x)
  }

  const ta = opts.tagArtist.trim()
  const tt = opts.tagTitle.trim()
  const al = opts.tagAlbum?.trim() ?? ''

  if (ta && tt) {
    add(`${ta} ${tt}`)
    add(`${ta} - ${tt}`)
  }
  if (tt) add(tt)
  if (ta && !tt) add(ta)
  if (al && ta) add(`${ta} ${al}`)
  if (al && tt) add(`${tt} ${al}`)

  for (const variant of titleSearchVariants(tt)) {
    if (ta) {
      add(`${ta} ${variant}`)
      add(`${ta} - ${variant}`)
    }
    add(variant)
  }

  return out
}

export function titleSearchVariants(title: string): string[] {
  const out: string[] = []
  const add = (s: string) => {
    const x = collapseSpaces(s)
    if (x.length >= 2 && !out.includes(x)) out.push(x)
  }

  const base = title.trim()
  if (!base) return out

  add(base.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, ' '))
  add(base.replace(/\s*[-–—]\s*live\b.*$/i, ''))
  add(base.replace(/\s*[-–—]\s*.*$/, ''))

  return out
}

function artistTitleLooksLikeFileSlug(t: string): boolean {
  const compact = t.replace(/\s/g, '')
  return (
    /^_+/.test(t) ||
    /_\(/.test(t) ||
    /\([^)]*\.(?:cc|ru|net|org|com|pw)\)/i.test(t) ||
    (/^[A-Za-z0-9_]+$/.test(compact) && /_/.test(t)) ||
    /^[A-Z0-9_]{3,}_?$/.test(compact)
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripRedundantArtistFromTitle(title: string, artist: string): string {
  const a = artist.trim()
  let t = title.trim()
  if (!a || !t) return title.trim()

  const ea = escapeRegExp(a)
  const suf = new RegExp(`\\s*[-–—|｜/]\\s*${ea}\\s*$`, 'i')
  let next = t.replace(suf, '').trim()
  if (next.length > 0 && next !== t) t = next

  const pre = new RegExp(`^${ea}\\s*[-–—|｜/]\\s*`, 'i')
  next = t.replace(pre, '').trim()
  if (next.length > 0 && next !== t) t = next

  return t
}

export function mergeTrackDisplayFromFilename(
  fileName: string,
  info: { title: string; artist: string; album: string; cover: string },
): { title: string; artist: string; album: string; cover: string } {
  const finish = (r: { title: string; artist: string; album: string; cover: string }) => ({
    ...r,
    title: stripRedundantArtistFromTitle(r.title, r.artist),
  })

  const parsed = parseArtistTitleFromFilename(fileName)
  const fallbackTitle = fileName.replace(/\.[^/.]+$/, '').trim()
  const ta = info.artist.trim()
  const tt = info.title.trim()

  const norm = (s: string) =>
    s
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()

  const titleIsRawStem =
    tt === fallbackTitle ||
    (fallbackTitle.length > 0 && norm(tt) === norm(fallbackTitle))

  const titleGarbage = artistTitleLooksLikeFileSlug(tt)
  const artistGarbage = artistTitleLooksLikeFileSlug(ta)

  const weakTags =
    !ta || !tt || titleIsRawStem || titleGarbage || artistGarbage

  if (parsed) {
    const pa = parsed.artist.trim()
    const pt = parsed.title.trim()

    if (pa && pt) {
      const forwardMatch = norm(ta) === norm(pa) && norm(tt) === norm(pt)
      const swappedMatch = norm(ta) === norm(pt) && norm(tt) === norm(pa)

      if (titleIsRawStem && ta && norm(tt) === norm(fallbackTitle)) {
        if (norm(ta) === norm(pt)) {
          return finish({ ...info, artist: ta, title: pa })
        }
        if (norm(ta) === norm(pa)) {
          return finish({ ...info, artist: ta, title: pt })
        }
      }

      if (!weakTags) {
        return finish(info)
      }

      if (swappedMatch && !forwardMatch) {
        return finish({ ...info, artist: pt, title: pa })
      }
      if (forwardMatch) return finish(info)
      return finish({ ...info, artist: pa, title: pt })
    }

    if (pt) {
      if (!ta && titleIsRawStem) {
        return finish({ ...info, artist: '', title: pt })
      }
      if (titleIsRawStem) {
        return finish({ ...info, title: pt, artist: ta || '' })
      }
      if (weakTags) {
        return finish({ ...info, title: pt, artist: ta || '' })
      }
    }
  }

  if (!parsed && titleGarbage) {
    const hintTitle = filenameAsSearchHint(fileName)
    const artistClean = ta ? cleanSegment(ta) : ''
    if (hintTitle.length >= 2) {
      return finish({
        ...info,
        title: hintTitle,
        artist: artistClean || info.artist,
      })
    }
  }

  return finish(info)
}
