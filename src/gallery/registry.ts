import type { VizMeta } from './types'

const registry: VizMeta[] = []

export function registerViz(meta: VizMeta): void {
  registry.push(meta)
}

export function getAllVizes(): VizMeta[] {
  return registry
}

export function getVizById(id: string): VizMeta | undefined {
  return registry.find((v) => v.id === id)
}
