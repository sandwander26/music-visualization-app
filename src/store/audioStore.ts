import { create } from 'zustand'
import type { MoodId } from '../audio/moodEngine'

export type AudioMode = 'file' | 'system'

export interface MoodSession {
  selectedMood: MoodId | null
  queue: string[]
  position: number
  recentVizes: string[]
}

export const EMPTY_MOOD_SESSION: MoodSession = {
  selectedMood: null,
  queue: [],
  position: 0,
  recentVizes: [],
}

interface AudioState {
  audioData: Float32Array
  isPlaying: boolean
  beat: boolean
  energy: number
  currentTime: number
  moodSessions: Partial<Record<MoodId, MoodSession>>
  audioMode: AudioMode
  setAudioData: (data: Float32Array) => void
  setPlaying: (playing: boolean) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setCurrentTime: (time: number) => void
  updateMoodSession: (mood: MoodId, patch: Partial<MoodSession>) => void
  setAudioMode: (mode: AudioMode) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  audioData: new Float32Array(1024),
  isPlaying: false,
  beat: false,
  energy: 0,
  currentTime: 0,
  moodSessions: {},
  audioMode: 'file',
  setAudioData: (audioData) => set({ audioData }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBeat: (beat) => set({ beat }),
  setEnergy: (energy) => set({ energy }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  updateMoodSession: (mood, patch) => set((s) => ({
    moodSessions: { ...s.moodSessions, [mood]: { ...(s.moodSessions[mood] ?? EMPTY_MOOD_SESSION), ...patch } },
  })),
  setAudioMode: (audioMode) => set({ audioMode }),
}))
