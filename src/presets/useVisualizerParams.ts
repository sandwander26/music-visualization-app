import { useMemo } from 'react'
import { usePresetsStore } from './presetsStore'
import { PARAM_SCHEMAS } from './paramSchemas'

export function useVisualizerParams<T>(visualizerId: string): T {
  const currentParams = usePresetsStore((s) => s.currentParams[visualizerId])
  return useMemo(() => {
    const schema = PARAM_SCHEMAS[visualizerId] ?? []
    const result: Record<string, unknown> = {}
    for (const p of schema) {
      result[p.id] = currentParams?.[p.id] ?? p.default
    }
    return result as T
  }, [currentParams, visualizerId])
}
