import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeStore {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  cycleMode: () => void
}

const STORAGE_KEY = 'theme-mode'

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return systemPrefersDark() ? 'dark' : 'light'
}

function applyDom(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

const initialMode = readStoredMode()
const initialResolved = resolveTheme(initialMode)
applyDom(initialResolved)

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  resolvedTheme: initialResolved,
  setMode: (mode) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, mode)
    const resolved = resolveTheme(mode)
    applyDom(resolved)
    set({ mode, resolvedTheme: resolved })
  },
  cycleMode: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const next = order[(order.indexOf(get().mode) + 1) % order.length]
    get().setMode(next)
  },
}))

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (useThemeStore.getState().mode !== 'system') return
    const resolved: ResolvedTheme = mq.matches ? 'dark' : 'light'
    applyDom(resolved)
    useThemeStore.setState({ resolvedTheme: resolved })
  }
  mq.addEventListener('change', handler)
}
