import type { VizMeta } from './gallery/types'
import { CircularVisualizer } from './visual/CircularVisualizer'
import { BarcodeVisualizer } from './visual/BarcodeVisualizer'
import { GalaxyVisualizer } from './visual/GalaxyVisualizer'
import { GeometryVisualizer } from './visual/GeometryVisualizer'
import { ParticlesVisualizer } from './visual/ParticlesVisualizer'
import { TunnelBarsVisualizer } from './visual/TunnelBarsVisualizer'

export const VIZ_ITEMS: VizMeta[] = [
  { id: 'circular', name: 'Circular', category: 'basic', component: CircularVisualizer },
  { id: 'barcode', name: 'Barcode', category: 'effects', component: BarcodeVisualizer },
  { id: 'galaxy', name: 'Galaxy', category: 'atmosphere', component: GalaxyVisualizer },
  { id: 'geometry', name: 'Geometry', category: 'basic', component: GeometryVisualizer },
  { id: 'particles', name: 'Particles', category: 'effects', component: ParticlesVisualizer },
  { id: 'tunnelbars', name: 'TunnelBars', category: 'effects', component: TunnelBarsVisualizer },
]
