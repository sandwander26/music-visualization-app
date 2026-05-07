import { create } from 'zustand'
import type { MoodId } from '../audio/moodEngine'
import type { UserVisualizerMeta, UserVisualizerRuntime } from './types'
import { compileUserViz } from './compiler'
import {
  saveUserVizFile,
  readUserVizFile,
  deleteUserVizFile,
  loadUserVizManifest,
  saveUserVizManifest,
  saveUserVizPreview,
  loadUserVizPreviewUrl,
  deleteUserVizPreview,
  isUserVizPersistenceAvailable,
} from './storage'
import { generateUserVizPreview } from './previewGenerator'

const ID_PREFIX = 'user-'

export function makeUserVizId(): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return `${ID_PREFIX}${raw}`
}

export function isUserVizId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(ID_PREFIX)
}

export type AddVisualizerStage = 'compile' | 'save' | 'preview' | 'manifest' | 'done'

interface UserVizState {
  visualizers: UserVisualizerRuntime[]
  isLoading: boolean
  loadFromDisk: () => Promise<void>
  addVisualizer: (
    file: File,
    name: string,
    moods: MoodId[],
    onStage?: (stage: AddVisualizerStage) => void,
  ) => Promise<UserVisualizerRuntime>
  removeVisualizer: (vizId: string) => Promise<void>
  recompileVisualizer: (vizId: string) => Promise<void>
  getById: (vizId: string) => UserVisualizerRuntime | undefined
}

function metaFromRuntime(r: UserVisualizerRuntime): UserVisualizerMeta {
  const meta: UserVisualizerMeta = {
    id: r.id,
    name: r.name,
    moods: r.moods,
    sourcePath: r.sourcePath,
    createdAt: r.createdAt,
  }
  if (r.previewPath) meta.previewPath = r.previewPath
  return meta
}

async function persistCurrentManifest(): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  const all = useUserVizStore.getState().visualizers
  try {
    await saveUserVizManifest(all.map(metaFromRuntime))
  } catch (err) {
    console.warn('[userViz] не удалось сохранить манифест:', err)
  }
}

export const useUserVizStore = create<UserVizState>((set, get) => ({
  visualizers: [],
  isLoading: false,

  loadFromDisk: async () => {
    if (!isUserVizPersistenceAvailable()) return
    if (get().isLoading) return
    set({ isLoading: true })
    try {
      const metas = await loadUserVizManifest()
      const restored: UserVisualizerRuntime[] = []
      for (const m of metas) {
        let component = null
        let error: string | null = null
        try {
          const source = await readUserVizFile(m.sourcePath)
          const compiled = compileUserViz(source)
          component = compiled.component
          error = compiled.error
        } catch (err) {
          error = err instanceof Error ? err.message : String(err)
        }
        let previewUrl: string | null = null
        if (m.previewPath) {
          try {
            previewUrl = await loadUserVizPreviewUrl(m.previewPath)
          } catch (err) {
            console.warn('[userViz] не удалось загрузить превью', m.previewPath, err)
          }
        }
        restored.push({ ...m, component, error, previewUrl })