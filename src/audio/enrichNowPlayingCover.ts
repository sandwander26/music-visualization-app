import { useAudioStore } from '../store/audioStore'
import { resolveCoverBlobUrl } from '../services/itunesCover'
import type { LibraryTrack } from '../store/libraryStore'

export type CoverEnrichAnchor = {
  fileName: string | null
  fileSize: number | null
}

function findLibraryTrackIdForCover(
  tracks: LibraryTrack[],
  currentTrackId: string | null,
  anchor: CoverEnrichAnchor | null | undefined,
  durationSec?: number,
): string | undefined {
  if (!anchor?.fileName || anchor.fileSize == null) {
    if (!currentTrackId) return undefined
    const tr = tracks.find((x) => x.id === currentTrackId && !x.cover)
    return tr?.id
  }
  const fn = anchor.fileName.trim()
  const sz = anchor.fileSize

  const bySize = tracks.find(
    (x) =>
      x.originalFileName?.trim() === fn &&
      (x.sourceFileSize ?? x.file?.size) === sz &&
      !x.cover,
  )
  if (bySize) return bySize.id

  if (durationSec != null && durationSec > 0.05) {
    const byDur = tracks.find(
      (x) =>
        x.originalFileName?.trim() === fn &&
        !x.cover &&
        Math.abs(x.duration - durationSec) < 1,
    )
    if (byDur) return byDur.id
  }
  return undefined
}

export async function enrichNowPlayingCover(
  artist: string,
  title: string,
  durationSec?: number,
  anchor?: CoverEnrichAnchor | null,
): Promise<void> {
  const t = title.trim()
  if (!t) return

  const tmpUrl = await resolveCoverBlobUrl({
    artist,
    title: t,
    durationSec,
  })
  if (!tmpUrl) return

  const st = useAudioStore.getState()
  if (anchor) {
    const match =
      st.sourceFileName === anchor.fileName && st.sourceFileSize === anchor.fileSize
    if (!match) {
      URL.revokeObjectURL(tmpUrl)
      return
    }
  }
  if (st.trackInfo.cover) {
    URL.revokeObjectURL(tmpUrl)
    return
  }

  let blob: Blob
  try {
    blob = await fetch(tmpUrl).then((r) => r.blob())
  } catch {
    URL.revokeObjectURL(tmpUrl)
    return
  }
  URL.revokeObjectURL(tmpUrl)

  const libMod = await import('../store/libraryStore')
  const libStore = libMod.useLibraryStore.getState()
  const libTrackId = findLibraryTrackIdForCover(
    libStore.tracks,
    libStore.currentTrackId,
    anchor,
    durationSec,
  )

  let libraryCoverUrl: string | null = null
  if (libTrackId) {
    const tr = libMod.useLibraryStore.getState().tracks.find((x) => x.id === libTrackId)
    if (tr && !tr.cover) libraryCoverUrl = URL.createObjectURL(blob)
  }

  const playerCoverUrl = URL.createObjectURL(blob)

  const audioNow = useAudioStore.getState()
  if (anchor) {
    const match =
      audioNow.sourceFileName === anchor.fileName && audioNow.sourceFileSize === anchor.fileSize
    if (!match) {
      URL.revokeObjectURL(playerCoverUrl)
      if (libraryCoverUrl) URL.revokeObjectURL(libraryCoverUrl)
      return
    }
  }
  if (audioNow.trackInfo.cover) {
    URL.revokeObjectURL(playerCoverUrl)
    if (libraryCoverUrl) URL.revokeObjectURL(libraryCoverUrl)
    return
  }

  useAudioStore.setState((s) => {
    const prev = s.trackInfo.cover
    if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    return { trackInfo: { ...s.trackInfo, cover: playerCoverUrl } }
  })

  if (libraryCoverUrl && libTrackId) {
    libMod.useLibraryStore.getState().applyEnrichedCover(libTrackId, libraryCoverUrl)
  }
}
