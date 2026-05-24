import { useEffect } from 'react'
import { useUIStore } from './store/uiStore'
import { useThemeStore } from './store/themeStore'
import { useAudioStore, EMPTY_MOOD_SESSION } from './store/audioStore'
import { useLibraryStore } from './store/libraryStore'
import { useUserVizStore } from './userViz/userVizStore'
import { audioEngine } from './audio/audioEngine'
import { autoPlayIfLyricsReady, loadTrack } from './library/playback'
import { applyStoredSettingsOnStartup } from './store/settingsStore'
import { useAuthStore } from './store/authStore'
import { pickVizForMood } from './audio/moodEngine'
import { getAllVisualizersInfoSnapshot } from './gallery/all'
import TopNav from './components/TopNav'
import ProfileModal from './components/ProfileModal'
import SettingsModal from './components/SettingsModal'
import LyricsSearchModal from './components/player/LyricsSearchModal'
import VisualizersGallery from './pages/VisualizersGallery'
import Library from './pages/Library'
import Wave from './pages/Wave'
import UserVizPage from './pages/UserVizPage'
import PlayerOverlay from './components/player/PlayerOverlay'
import MiniPlayer from './components/MiniPlayer'

export default function App() {
  const currentTab = useUIStore((s) => s.currentTab)
  const profileOpen = useUIStore((s) => s.profileOpen)
  const setProfileOpen = useUIStore((s) => s.setProfileOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  useThemeStore()

  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const currentPlaylistMood = useAudioStore((s) => s.currentPlaylistMood)
  const clearPlaylistQueue = useAudioStore((s) => s.clearPlaylistQueue)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const selectedVizId = useUIStore((s) => s.selectedVizId)

  useEffect(() => {
    if (!currentPlaylistMood || !currentTrackId) return
    const store = useAudioStore.getState()
    const session = store.moodSessions[currentPlaylistMood] ?? EMPTY_MOOD_SESSION
    const pool = getAllVisualizersInfoSnapshot()
    const result = pickVizForMood(currentPlaylistMood, currentTrackId, pool, {
      avoided: session.avoidedVizIds,
      lastPickedForTrack: session.lastPickedForTrack,
    })
    if (result.vizId) {
      store.updateMoodSession(currentPlaylistMood, {
        currentVizId: result.vizId,
        avoidedVizIds: result.avoided,
        lastPickedForTrack: result.lastPickedForTrack,
      })
      setSelectedVizId(result.vizId)
    }
  }, [currentTrackId, currentPlaylistMood, setSelectedVizId])

  useEffect(() => {
    if (!currentPlaylistMood) return
    if (!selectedVizId) return
    const session = useAudioStore.getState().moodSessions[currentPlaylistMood]
    if (selectedVizId === session?.currentVizId) return
    useAudioStore.getState().updateMoodSession(currentPlaylistMood, { currentVizId: selectedVizId })
    clearPlaylistQueue()
  }, [selectedVizId, currentPlaylistMood, clearPlaylistQueue])

  useEffect(() => {
    audioEngine.onTrackEnd = () => {
      const audio = useAudioStore.getState()
      const lib = useLibraryStore.getState()
      if (!audio.currentPlaylistMood || audio.playlistQueue.length === 0) return
      const idx = lib.currentTrackId ? audio.playlistQueue.indexOf(lib.currentTrackId) : -1
      if (idx === -1 || idx >= audio.playlistQueue.length - 1) return
      const nextId = audio.playlistQueue[idx + 1]
      const nextTrack = lib.tracks.find((t) => t.id === nextId)
      if (!nextTrack) return
      void (async () => {
        try {
          await loadTrack(nextTrack)
          autoPlayIfLyricsReady()
          lib.setCurrentTrack(nextTrack.id)
        } catch (err) {
          console.warn('[wave] auto-advance не удался', err)
        }
      })()
    }
    return () => { audioEngine.onTrackEnd = null }
  }, [])

  const loadLibraryFromDisk = useLibraryStore((s) => s.loadLibraryFromDisk)
  const loadUserVizFromDisk = useUserVizStore((s) => s.loadFromDisk)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  useEffect(() => {
    void (async () => {
      applyStoredSettingsOnStartup()
      await loadLibraryFromDisk()
      await loadUserVizFromDisk()
      await restoreSession()
    })()
  }, [loadLibraryFromDisk, loadUserVizFromDisk, restoreSession])

  return (
    <>
      <TopNav />
      <div style={{ paddingTop: 60 }}>
        {currentTab === 'visualizers' && <VisualizersGallery />}
        {currentTab === 'library' && <Library />}
        {currentTab === 'wave' && <Wave />}
        {currentTab === 'user-viz' && <UserVizPage />}
      </div>
      <PlayerOverlay />
      <MiniPlayer />
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LyricsSearchModal />
    </>
  )
}
