import {
  deleteTrackAudio,
  fetchTrackAudio,
  putTrackAudio,
} from './cloudApi'
import { useAuthStore } from '../store/authStore'
import { useLibraryStore } from '../store/libraryStore'
import {
  audioMimeFromPath,
  ensureLibraryDirs,
  loadTrackBytes,
  saveTrackFiles,
} from '../library/persistence'
import { isPendingAudioPath } from '../utils/trackCloud'
import { scheduleCloudPush } from './cloudSync'

function audioExtFromMime(mime: string): string {
  if (mime.includes('flac')) return 'flac'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('ogg')) return 'ogg'
  return 'mp3'
}

export async function downloadCloudAudioToDevice(trackId: string): Promise<void> {
  const token = useAuthStore.getState().token
  if (!token) throw new Error('войди в аккаунт')

  const track = useLibraryStore.getState().tracks.find((t) => t.id === trackId)
  if (!track) throw new Error('трек не найден')

  const remote = await fetchTrackAudio(token, trackId)
  const bytes = Uint8Array.from(atob(remote.dataBase64), (c) => c.charCodeAt(0))
  const ext = audioExtFromMime(remote.mime)
  const fileName =
    track.originalFileName?.replace(/\.[^/.]+$/i, `.${ext}`) ??
    `${track.name}.${ext}`

  await ensureLibraryDirs()
  const blob = new Blob([bytes as BlobPart], { type: remote.mime })
  const file = new File([blob], fileName, { type: remote.mime })
  const saved = await saveTrackFiles(file, null, trackId)

  useLibraryStore.setState((s) => ({
    tracks: s.tracks.map((t) =>
      t.id === trackId
        ? {
            ...t,
            audioPath: saved.audioPath,
            originalFileName: fileName,
            sourceFileSize: bytes.byteLength,
            file,
          }
        : t,
    ),
  }))

  await useLibraryStore.getState().persistManifest()
  scheduleCloudPush('audio-downloaded')
}

export async function uploadLocalAudioToCloud(trackId: string): Promise<void> {
  const token = useAuthStore.getState().token
  if (!token) throw new Error('войди в аккаунт')

  const track = useLibraryStore.getState().tracks.find((t) => t.id === trackId)
  if (!track?.audioPath || isPendingAudioPath(track.audioPath)) {
    throw new Error('сначала добавь аудиофайл на это устройство')
  }

  const bytes = await loadTrackBytes(track.audioPath)
  const mime = audioMimeFromPath(track.audioPath)

  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const dataBase64 = btoa(binary)

  await putTrackAudio(token, trackId, mime, dataBase64)
  const ids = new Set(useAuthStore.getState().cloudAudioTrackIds)
  ids.add(trackId)
  useAuthStore.getState().setCloudAudioTrackIds([...ids])
  await useAuthStore.getState().refreshMe()
}

export async function removeCloudAudio(trackId: string): Promise<void> {
  const token = useAuthStore.getState().token
  if (!token) throw new Error('войди в аккаунт')
  await deleteTrackAudio(token, trackId)
  useAuthStore
    .getState()
    .setCloudAudioTrackIds(
      useAuthStore.getState().cloudAudioTrackIds.filter((id) => id !== trackId),
    )
  await useAuthStore.getState().refreshMe()
}
