import { useMemo } from 'react'
import { GALLERY } from './registry'
import { useUserVizStore } from '../userViz/userVizStore'
import type { MoodId } from '../audio/moodEngine'

export interface VizInfo {
  id: string
  name: string
  moods: MoodId[]
  isUserViz: boolean
}

export function useAllVisualizersInfo(): VizInfo[] {
  const userVisualizers = useUserVizStore((s) => s.visualizers)
  return useMemo(() => {
    const userInfo: VizInfo[] = userVisualizers.map((u) => ({
      id: u.id,
      name: u.name,
      moods: u.moods,
      isUserViz: true,
    }))
    const builtinInfo: VizInfo[] = GALLERY.map((g) => ({
      id: g.id,
      name: g.name,
      moods: g.moods,
      isUserViz: false,
    }))
    return [...userInfo, ...builtinInfo]
  }, [userVisualizers])
}

export function getAllVisualizersInfoSnapshot(): VizInfo[] {
  const userVisualizers = useUserVizStore.getState().visualizers
  const userInfo: VizInfo[] = userVisualizers.map((u) => ({
    id: u.id,
    name: u.name,
    moods: u.moods,
    isUserViz: true,
  }))
  const builtinInfo: VizInfo[] = GALLERY.map((g) => ({
    id: g.id,
    name: g.name,
    moods: g.moods,
    isUserViz: false,
  }))
  return [...userInfo, ...builtinInfo]
}
