import { create } from 'zustand'
import type { LrcLine } from '../utils/lrcParser'
import type { MoodId } from '../audio/moodEngine'
import { audioEngine } from '../audio/audioEngine'
import { enrichNowPlayingCover } from '../audio/enrichNowPlayingCover'
import { startSystemCapture, stopSystemCapture } from '../audio/systemAudioCapture'

export type AudioMode = 'file' | 'system'

interface TrackInfo {
  title: string
  artist: string
  album: string
  cover: string
}

type Section = 'verse' | 'chorus' | 'bridge' | 'unknown'

export interface MoodSession {
  playlistQueue: string[]
  currentTrackId: string | null
  currentTrackPosition: number
  currentVizId: string | null
  avoidedVizIds: string[]
  lastPickedForTrack: string | null
}

export const EMPTY_MOOD_SESSION: MoodSession = {
  playlistQueue: [],
  currentTrackId: null,
  currentTrackPosition: 0,
  currentVizId: null,
  avoidedVizIds: [],
  lastPickedForTrack: null,
}

interface AudioState {
  audioData: Float32Array
  beat: boolean
  energy: number
  section: Section
  currentLyric: string
  currentTime: number
  trackInfo: TrackInfo
  isPlaying: boolean
  volume: number
  
  lrcLines: LrcLine[]
  playlistQueue: string[]
  currentPlaylistMood: MoodId | null
  moodSessions: Partial<Record<MoodId, MoodSession>>

  sourceFileName: string | null
  sourceFileSize: number | null
  trackPrepareBusy: boolean
  catalogLabelsFromDiskCache: boolean
  audioMode: AudioMode

  setAudioData: (data: Float32Array) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setSection: (section: Section) => void
  setCurrentLyric: (lyric: string) => void
  setCurrentTime: (time: number) => void
  setTrackInfo: (info: TrackInfo) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setLrcLines: (lines: LrcLine[]) => void
  setPlaylistQueue: (trackIds: string[], mood: MoodId | null) => void
  clearPlaylistQueue: () => void
  updateMoodSession: (mood: MoodId, patch: Partial<MoodSession>) => void

  setSourceFileName: (name: string | null) => void
  setSourceFileSize: (size: number | null) => void
  applyCatalogTrackLabels: (
    artist: string | undefined,
    title: string | undefined,
    album?: string | undefined,
  ) => void
  setTrackPrepareBusy: (v: boolean) => void
  setCatalogLabelsFromDiskCache: (v: boolean) => void
  setAudioMode: (mode: AudioMode) => Promise<void>
}

export const useAudioStore = create<AudioState>((set, get) => ({
  audioData: new Float32Array(),
  beat: false,
  energy: 0,
  section: 'unknown',
  currentLyric: '',
  currentTime: 0,
  trackInfo: { title: '', artist: '', album: '', cover: '' },
  isPlaying: false,
  volume: 1,
  lrcLines: [],
  playlistQueue: [],
  currentPlaylistMood: null,
  moodSessions: {},

  sourceFileName: null,
  sourceFileSize: null,
  trackPrepareBusy: false,
  catalogLabelsFromDiskCache: false,
  audioMode: 'file',

  setAudioData: (data) => set({ audioData: data }),
  setBeat: (beat) => set({ beat }),
  setEnergy: (energy) => set({ energy }),
  setSection: (section) => set({ section }),
  setCurrentLyric: (lyric) => set({ currentLyric: lyric }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setTrackInfo: (info) => set({ trackInfo: info }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setLrcLines: (lines) => set({ lrcLines: lines }),
  setPlaylistQueue: (trackIds, mood) => set({ playlistQueue: trackIds, currentPlaylistMood: mood }),
  clearPlaylistQueue: () => set({ playlistQueue: [], currentPlaylistMood: null }),
  updateMoodSession: (mood, patch) =>
    set((s) => {
      const prev = s.moodSessions[mood] ?? EMPTY_MOOD_SESSION
      return { moodSessions: { ...s.moodSessions, [mood]: { ...prev, ...patch } } }
    }),

  setSourceFileName: (name) => set({ sourceFileName: name }),
  setSourceFileSize: (size) => set({ sourceFileSize: size }),
  applyCatalogTrackLabels: (artist, title, album) => {
    set((s) => {
      const a = artist?.trim()
      const t = title?.trim()
      const al = album?.trim()
      if (!a && !t && !al) return {}
      return {
        trackInfo: {
          ...s.trackInfo,
          ...(a ? { artist: a } : {}),
          ...(t ? { title: t } : {}),
          ...(al ? { album: al } : {}),
        },
      }
    })
    queueMicrotask(() => {
      void import('./libraryStore').then(({ useLibraryStore }) => {
        useLibraryStore.getState().syncTrackDisplayFromAudio()
      })
      const st = useAudioStore.getState()
      if (st.trackInfo.cover) return
      const tit = st.trackInfo.title.trim()
      if (!tit) return
      const dur = audioEngine.getDuration()
      void enrichNowPlayingCover(st.trackInfo.artist, st.trackInfo.title, dur > 0 ? dur : undefined, {
        fileName: st.sourceFileName,
        fileSize: st.sourceFileSize,
      })
    })
  },
  setTrackPrepareBusy: (v) => set({ trackPrepareBusy: v }),
  setCatalogLabelsFromDiskCache: (v) => set({ catalogLabelsFromDiskCache: v }),

  setAudioMode: async (mode) => {
    const current = get().audioMode
    if (current === mode) return
    if (mode === 'system') {
      audioEngine.pause()
      set({
        audioMode: 'system',
        trackInfo: { title: 'Системный звук', artist: '', album: '', cover: '' },
        audioData: new Float32Array(1024),
        energy: 0,
        beat: false,
        currentTime: 0,
        isPlaying: true,
      })
      try {
        await startSystemCapture()
        audioEngine.markSystemStart()
        audioEngine.stopLoop()
        audioEngine.startLoop()
      } catch (err) {
        console.error('[audioMode] startSystemCapture failed:', err)
        set({ audioMode: 'file' })
        throw err
      }
    } else {
      await stopSystemCapture()
      audioEngine.stopLoop()
      set({
        audioMode: 'file',
        audioData: new Float32Array(1024),
        energy: 0,
        beat: false,
        isPlaying: false,
      })
    }
  },
}))
