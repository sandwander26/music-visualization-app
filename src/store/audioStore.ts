import { create } from 'zustand'

interface AudioState {
  audioData: Float32Array
  isPlaying: boolean
  setAudioData: (data: Float32Array) => void
  setPlaying: (playing: boolean) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  audioData: new Float32Array(1024),
  isPlaying: false,
  setAudioData: (audioData) => set({ audioData }),
  setPlaying: (isPlaying) => set({ isPlaying }),
}))
