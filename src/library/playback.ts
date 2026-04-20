import { audioEngine } from '../audio/audioEngine'
import type { LibraryTrack } from '../store/libraryStore'

export async function loadTrack(track: LibraryTrack): Promise<void> {
  const hint = {
    title: track.name,
    artist: track.artist,
    album: track.album,
    cover: track.cover ?? '',
  }
  if (track.audioPath) {
    await audioEngine.loadFromPath(track.audioPath, track.originalFileName ?? null)
    void hint
    return
  }
  if (track.file) {
    await audioEngine.loadFile(track.file)
    return
  }
  throw new Error('Трек не имеет источника аудио')
}

export function autoPlayIfLyricsReady(): void {
  audioEngine.play()
}
