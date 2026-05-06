import {
  resolveBestSyncedLyricsCandidate,
  searchSyncedLyricsCandidates,
  catalogLabelsFromCandidate,
  fetchGetCachedSyncedCandidate,
  fetchGetCachedTrackRecord,
  rankLyricsCandidates,
  type RankedLrclibCandidate,
  type LrclibCandidate,
} from '../services/lrclibClient'
import {
  endLrclibProbe,
  isLyricsCatalogFinished,
  resetLyricsCatalogStateForRetry,
  tryBeginLrclibProbe,
} from '../services/lyricsCatalogSession'
import { readLyricsDiskCache, writeLyricsDiskCache, clearLyricsDiskCache } from '../services/lyricsDiskCache'
import { useAudioStore } from '../store/audioStore'
import {
  buildLrclibSearchQueries,
  buildLrclibSearchQueriesFromTags,
  catalogLabelsPlausibleForFile,
  metadataWeakForAutoLyrics,
  parseArtistTitleFromFilename,
} from '../utils/filenameMeta'
import { makeTrackLyricsKey } from '../utils/trackLyricsKey'
import { parseLrc } from '../utils/lrcParser'

export type AutoLyricsResult =
  | 'skipped_lines'
  | 'skipped_done'
  | 'skipped_mutex'
  | 'applied'
  | 'none'
  | 'ambiguous'
  | 'network'

export type RankedLyricsFetchResult =
  | { status: 'ok'; items: RankedLrclibCandidate[] }
  | { status: 'none' }
  | { status: 'network' }

interface AutoLyricsOptions {
  forceRetry?: boolean
  
  forceReplace?: boolean
  
  tagsOnly?: boolean
  
  trustManualMeta?: boolean
}

function buildQueriesFromSnapshot(
  snap: ReturnType<typeof useAudioStore.getState>,
  tagsOnly: boolean,
): string[] {
  const { trackInfo, sourceFileName } = snap
  if (tagsOnly) {
    return buildLrclibSearchQueriesFromTags({
      tagArtist: trackInfo.artist,
      tagTitle: trackInfo.title,
      tagAlbum: trackInfo.album,
    })
  }
  return buildLrclibSearchQueries({
    tagArtist: trackInfo.artist,
    tagTitle: trackInfo.title,
    sourceFileName,
  })
}

function lyricsMatchContextFromSnapshot(
  snap: ReturnType<typeof useAudioStore.getState>,
  durationSec: number | undefined,
  strictAutoPick = false,
) {
  const parsed = snap.sourceFileName ? parseArtistTitleFromFilename(snap.sourceFileName) : null
  return {
    durationSec,
    hintArtist: snap.trackInfo.artist,
    hintTitle: snap.trackInfo.title,
    filenameArtist: parsed?.artist,
    filenameTitle: parsed?.title,
    strictAutoPick,
  }
}

function resolveChosenLyricsCandidate(
  items: LrclibCandidate[],
  matchCtx: ReturnType<typeof lyricsMatchContextFromSnapshot>,
  trustManualMeta: boolean,
): LrclibCandidate | null {
  if (!trustManualMeta) {
    return resolveBestSyncedLyricsCandidate(items, matchCtx)
  }

  const ranked = rankLyricsCandidates(items, matchCtx)
  if (ranked.length === 0) return null

  const top = ranked[0]
  if (top.isRecommended) return top
  if (top.matchScore >= 32) return top
  if (top.durationDeltaSec != null && top.durationDeltaSec <= 15) return top
  if (ranked.length === 1) return top

  return null
}

function applyChosenCandidateToStore(
  chosen: LrclibCandidate,
  snap: ReturnType<typeof useAudioStore.getState>,
  opts: { trustManualMeta?: boolean },
): AutoLyricsResult {
  const name = snap.sourceFileName
  const size = snap.sourceFileSize
  if (name == null || size == null) return 'ambiguous'

  const lines = parseLrc(chosen.syncedText)
  if (lines.length === 0) return 'ambiguous'

  const parsed = name ? parseArtistTitleFromFilename(name) : null
  useAudioStore.getState().setLrcLines(lines)

  const labels = catalogLabelsFromCandidate(chosen)
  const plausible =
    opts.trustManualMeta || catalogLabelsPlausibleForFile(name, labels.artist, labels.title)

  writeLyricsDiskCache(name, size, chosen.syncedText, {
    catalogArtist: plausible ? labels.artist : parsed?.artist,
    catalogTitle: plausible ? labels.title : parsed?.title,
  })
  if (plausible) {
    useAudioStore.getState().applyCatalogTrackLabels(labels.artist, labels.title)
  }
  return 'applied'
}

export function autoLyricsResultHint(r: AutoLyricsResult): string | null {
  switch (r) {
    case 'applied':
      return 'текст найден и загружен'
    case 'none':
      return 'нет вариантов с синхронным текстом — поправь теги / имя файла или .lrc'
    case 'ambiguous':
      return 'нет однозначного совпадения — открой «альтернативные источники текста» или файл .lrc'
    case 'network':
      return 'не удалось связаться с lrclib — проверь интернет или файрвол'
    default:
      return null
  }
}

export async function tryAutoAttachLyricsFromCatalog(
  durationSec: number | undefined,
  opts?: AutoLyricsOptions,
): Promise<AutoLyricsResult> {
  const forceRetry = opts?.forceRetry ?? false
  const forceReplace = opts?.forceReplace ?? false
  const tagsOnly = opts?.tagsOnly ?? false
  const trustManualMeta = opts?.trustManualMeta ?? false
  let snap = useAudioStore.getState()

  const name = snap.sourceFileName
  const size = snap.sourceFileSize
  if (name == null || size == null) return 'skipped_lines'

  const tk = makeTrackLyricsKey(name, size)

  if (forceReplace) {
    useAudioStore.getState().setLrcLines([])
    clearLyricsDiskCache(name, size)
    snap = useAudioStore.getState()
  }

  if (snap.lrcLines.length > 0 && !forceReplace) return 'skipped_lines'

  if (forceRetry || forceReplace) resetLyricsCatalogStateForRetry(tk)

  if (isLyricsCatalogFinished(tk)) return 'skipped_done'

  if (!tryBeginLrclibProbe(tk)) return 'skipped_mutex'

  let catalogProbeFinished = true

  try {
    snap = useAudioStore.getState()
    const hintArtist = snap.trackInfo.artist
    const hintTitle = snap.trackInfo.title
    const album = snap.trackInfo.album?.trim() ?? ''
    const parsed = name && !tagsOnly ? parseArtistTitleFromFilename(name) : null
    const effArtist = hintArtist.trim() || parsed?.artist?.trim() || ''
    const effTitle = hintTitle.trim() || parsed?.title?.trim() || ''
    const strictAutoPick =
      !trustManualMeta &&
      metadataWeakForAutoLyrics({
        tagArtist: hintArtist,
        tagTitle: hintTitle,
        sourceFileName: name,
      })

    const durOk =
      durationSec != null && durationSec > 0 ? durationSec : undefined

    if (album && durOk != null && effArtist && effTitle && !strictAutoPick) {
      const fromCached = await fetchGetCachedSyncedCandidate({
        artist: effArtist,
        title: effTitle,
        album,
        durationSec: durOk,
      })
      if (fromCached) {
        const after = useAudioStore.getState()
        if (after.lrcLines.length > 0) return 'skipped_lines'
        if (
          after.trackInfo.title !== snap.trackInfo.title ||
          after.trackInfo.artist !== snap.trackInfo.artist ||
          after.sourceFileName !== snap.sourceFileName ||
          after.sourceFileSize !== snap.sourceFileSize
        )
          return 'skipped_lines'

        return applyChosenCandidateToStore(fromCached, snap, { trustManualMeta })
      }
    }

    const queries = buildQueriesFromSnapshot(snap, tagsOnly)

    const res = await searchSyncedLyricsCandidates(
      queries,
      durationSec != null && durationSec > 0 ? durationSec : undefined,
    )

    if (res.status === 'network') {
      catalogProbeFinished = false
      return 'network'
    }
    if (res.status !== 'ok' || res.items.length === 0) return 'none'

    const matchCtx = lyricsMatchContextFromSnapshot(snap, durationSec, strictAutoPick)
    const chosen = resolveChosenLyricsCandidate(res.items, matchCtx, trustManualMeta)

    if (!chosen) return 'ambiguous'

    const after = useAudioStore.getState()
    if (after.lrcLines.length > 0) return 'skipped_lines'
    if (
      after.trackInfo.title !== snap.trackInfo.title ||
      after.trackInfo.artist !== snap.trackInfo.artist ||
      after.sourceFileName !== snap.sourceFileName ||
      after.sourceFileSize !== snap.sourceFileSize
    )
      return 'skipped_lines'

    return applyChosenCandidateToStore(chosen, snap, { trustManualMeta })
  } finally {
    endLrclibProbe(tk, catalogProbeFinished)
  }
}

export async function applyManualMetaAndSearchLyrics(
  artist: string,
  title: string,
  album: string,
  durationSec: number | undefined,
): Promise<AutoLyricsResult> {
  const a = artist.trim()
  const t = title.trim()
  const al = album.trim()
  if (!t) return 'none'

  const st = useAudioStore.getState()