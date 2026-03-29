import type { LibraryTrack } from '../store/libraryStore'

export function isPendingAudioPath(audioPath: string | null | undefined): boolean {
  return Boolean(audioPath?.includes('.pending'))
}

export function trackNeedsLocalFile(track: LibraryTrack): boolean {
  if (!track.audioPath) return true
  return isPendingAudioPath(track.audioPath)
}

export function trackHasPlayableAudio(track: LibraryTrack): boolean {
  return Boolean(track.audioPath && !isPendingAudioPath(track.audioPath))
}

export function trackCanPlay(
  track: LibraryTrack,
  cloudAudioTrackIds: readonly string[],
): boolean {
  if (track.file) return true
  if (trackHasPlayableAudio(track)) return true
  return trackNeedsLocalFile(track) && cloudAudioTrackIds.includes(track.id)
}
