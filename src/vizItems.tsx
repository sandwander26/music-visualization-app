import type { ReactElement } from 'react'
import { ParticlesVisualizer } from './visual/ParticlesVisualizer'
import { StarfieldVisualizer } from './visual/GalaxyVisualizer'
import { CircularVisualizer } from './visual/CircularVisualizer'
import { ShaderSphereVisualizer } from './visual/ShaderSphereVisualizer'
import { BarcodeVisualizer } from './visual/BarcodeVisualizer'
import { TunnelBarsVisualizer } from './visual/TunnelBarsVisualizer'
import { GeometryVisualizer } from './visual/GeometryVisualizer'
import { HaloVisualizer } from './visual/HaloVisualizer'
import { CosmicVisualizer } from './visual/CosmicVisualizer'
import UserVizDispatch from './userViz/UserVizDispatch'
import { isUserVizId } from './userViz/userVizStore'

export interface VizItem {
  key: string
  label: string
  icon: string
  category: string
}

export type VisualizerMode =
  | 'cosmic'
  | 'circular'
  | 'particles'
  | 'sphere'
  | 'galaxy'
  | 'barcode'
  | 'tunnelbars'
  | 'geometry'
  | 'halo'

export const VIZ_ITEMS: VizItem[] = [
  { key: 'cosmic', label: 'Космос', icon: '✦', category: 'Премиум' },
  { key: 'circular', label: 'Круг', icon: '◎', category: 'Базовые' },
  { key: 'particles', label: 'Частицы', icon: '✷', category: 'Эффекты' },
  { key: 'sphere', label: 'Сфера', icon: '◉', category: 'Эффекты' },
  { key: 'galaxy', label: 'Галактика', icon: '✧', category: 'Атмосфера' },
  { key: 'barcode', label: 'Баркод', icon: '┃', category: 'Эффекты' },
  { key: 'tunnelbars', label: 'Кино', icon: '■', category: 'Атмосфера' },
  { key: 'geometry', label: 'Геометрия', icon: '◇', category: 'Эффекты' },
  { key: 'halo', label: 'Halo', icon: '◯', category: 'Эффекты' },
]

export function renderVisualizer(mode: string): ReactElement {
  if (isUserVizId(mode)) {
    return <UserVizDispatch vizId={mode} />
  }
  switch (mode as VisualizerMode) {
    case 'cosmic': return <CosmicVisualizer />
    case 'circular': return <CircularVisualizer />
    case 'particles': return <ParticlesVisualizer />
    case 'sphere': return <ShaderSphereVisualizer />
    case 'galaxy': return <StarfieldVisualizer />
    case 'barcode': return <BarcodeVisualizer />
    case 'tunnelbars': return <TunnelBarsVisualizer />
    case 'geometry': return <GeometryVisualizer />
    case 'halo': return <HaloVisualizer />
    default: return <CosmicVisualizer />
  }
}
