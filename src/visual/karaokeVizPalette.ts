
export interface KaraokePalette {
  bottomGradient: string
  activeLineColor: string
  inactiveLineColor: string
  activeShadow: string
  inactiveShadow: string
  emptyHintColor: string
  emptyHintMuted: string
  chipBorder: string
  chipBg: string
  chipBgGhost: string
  chipFg: string
  chipFgMuted: string
}

const neutralVignette =
  'linear-gradient(180deg, transparent 0%, transparent 42%, rgba(0,0,0,.18) 72%, rgba(0,0,0,.48) 100%)'

const darkBase: KaraokePalette = {
  bottomGradient: neutralVignette,
  activeLineColor: '#faf8ff',
  inactiveLineColor: 'rgba(235, 233, 245, 0.38)',
  activeShadow: '0 0 22px rgba(0,0,0,.95), 0 2px 12px rgba(0,0,0,.92), 0 1px 2px rgba(0,0,0,.9)',
  inactiveShadow: '0 1px 10px rgba(0,0,0,.78)',
  emptyHintColor: 'rgba(255,255,255,0.5)',
  emptyHintMuted: 'rgba(255,255,255,0.34)',
  chipBorder: 'rgba(255,255,255,0.2)',
  chipBg: 'rgba(0,0,0,0.35)',
  chipBgGhost: 'rgba(0,0,0,0.22)',
  chipFg: '#f4f2ff',
  chipFgMuted: '#ddd8f0',
}

export const karaokeOverlayFallbackPalette: KaraokePalette = darkBase

const heavierFooter: Partial<KaraokePalette> = {
  bottomGradient:
    'linear-gradient(180deg, transparent 0%, transparent 36%, rgba(0,0,0,.24) 68%, rgba(0,0,0,.52) 100%)',
}

const overrides: Record<string, Partial<KaraokePalette>> = {
  barcode: heavierFooter,
  witchscope: heavierFooter,
  tunnelbars: heavierFooter,
}

function mergePalette(...parts: Partial<KaraokePalette>[]): KaraokePalette {
  return Object.assign({}, darkBase, ...parts)
}


export function getKaraokePalette(vizId: string): KaraokePalette {
  const isUserViz = vizId.startsWith('user-')
  const patch = overrides[vizId] ?? (isUserViz ? heavierFooter : {})
  return mergePalette(patch)
}
