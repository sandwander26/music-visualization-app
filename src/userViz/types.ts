import type { ComponentType } from 'react'
import type { MoodId } from '../audio/moodEngine'

export interface UserVisualizerMeta {
  id: string
  name: string
  moods: MoodId[]
  sourcePath: string
  createdAt: string
  previewPath?: string
}

export interface UserVizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
}

export interface UserVisualizerRuntime extends UserVisualizerMeta {
  component: ComponentType<UserVizProps> | null
  error: string | null
  previewUrl: string | null
}
