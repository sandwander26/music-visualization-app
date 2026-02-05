import { create } from 'zustand'

interface AudioState {
  audioData: Float32Array
  isPlaying: boolean
  beat: boolean
  energy: number
  currentTime: number
  setAudioData: (data: Float32Array) => void
  setPlaying: (playing: boolean) => void
  setBeat: (beat: boolean) => void
  setEnergy: (energy: number) => void
  setCurrentTime: (time: number) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  audioData: new Float32Array(1024),
  isPlaying: false,
  beat: false,
  energy: 0,
  currentTime: 0,
  setAudioData: (audioData) => set({ audioData }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBeat: (beat) => set({ beat }),
  setEnergy: (energy) => set({ energy }),
  setCurrentTime: (currentTime) => set({ currentTime }),
}))
