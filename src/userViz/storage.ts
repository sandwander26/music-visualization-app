import { idbGet, idbSet, idbDel } from '../utils/idb'
import type { UserVisualizerMeta } from './types'

const MANIFEST_KEY = 'userviz:manifest'
const sourceKey = (id: string) => `viz:${id}:source`
const previewKey = (id: string) => `viz:${id}:preview`

export function isUserVizPersistenceAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export async function saveUserVizFile(vizId: string, tsxSource: string): Promise<string> {
  if (!isUserVizPersistenceAvailable()) throw new Error('Persistence unavailable')
  const key = sourceKey(vizId)
  await idbSet(key, tsxSource)
  return key
}

export async function readUserVizFile(sourcePath: string): Promise<string> {
  if (!isUserVizPersistenceAvailable()) throw new Error('Persistence unavailable')
  const src = await idbGet<string>(sourcePath)
  if (typeof src !== 'string') throw new Error(`Виз не найден: ${sourcePath}`)
  return src
}

async function deleteByKey(key: string, label: string): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  try {
    await idbDel(key)
  } catch (err) {
    console.warn(`[userViz] не удалось удалить ${label}`, key, err)
  }
}

export async function deleteUserVizFile(sourcePath: string): Promise<void> {
  await deleteByKey(sourcePath, 'файл')
}

export async function saveUserVizPreview(vizId: string, jpegBlob: Blob): Promise<string> {
  if (!isUserVizPersistenceAvailable()) throw new Error('Persistence unavailable')
  const key = previewKey(vizId)
  await idbSet(key, jpegBlob)
  return key
}

export async function loadUserVizPreviewUrl(previewPath: string): Promise<string> {
  if (!isUserVizPersistenceAvailable()) throw new Error('Persistence unavailable')
  const blob = await idbGet<Blob>(previewPath)
  if (!blob) throw new Error(`Превью не найдено: ${previewPath}`)
  return URL.createObjectURL(blob)
}

export async function deleteUserVizPreview(previewPath: string): Promise<void> {
  await deleteByKey(previewPath, 'превью')
}

function isValidMeta(v: unknown): v is UserVisualizerMeta {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.moods) &&
    o.moods.every((m) => typeof m === 'string') &&
    typeof o.sourcePath === 'string' &&
    typeof o.createdAt === 'string' &&
    (o.previewPath === undefined || typeof o.previewPath === 'string')
  )
}

export async function loadUserVizManifest(): Promise<UserVisualizerMeta[]> {
  if (!isUserVizPersistenceAvailable()) return []
  try {
    const stored = await idbGet<UserVisualizerMeta[]>(MANIFEST_KEY)
    if (!Array.isArray(stored)) return []
    return stored.filter(isValidMeta)
  } catch (err) {
    console.warn('[userViz] чтение манифеста упало:', err)
    return []
  }
}

let writeChain: Promise<void> = Promise.resolve()

export async function saveUserVizManifest(metas: UserVisualizerMeta[]): Promise<void> {
  if (!isUserVizPersistenceAvailable()) return
  const job = async (): Promise<void> => {
    try {
      await idbSet(MANIFEST_KEY, metas)
    } catch (err) {
      console.warn('[userViz] запись манифеста упала:', err)
      throw err
    }
  }
  writeChain = writeChain.then(job, job)
  return writeChain
}

export async function ensureUserVizDirs(): Promise<void> {
}
