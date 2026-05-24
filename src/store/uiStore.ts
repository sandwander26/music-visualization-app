import { create } from 'zustand'

export type Tab = 'visualizers' | 'library' | 'wave' | 'user-viz'

export type LibraryView = 'list' | 'grid'

export type LyricsNotice = { kind: 'success' | 'error'; text: string } | null

interface UIStore {
  currentTab: Tab
  overlayOpen: boolean
  selectedVizId: string | null
  searchQuery: string
  isFullscreen: boolean
  libraryView: LibraryView
  
  karaokeOverlay: boolean
  profileOpen: boolean
  settingsOpen: boolean
  lyricsSearchOpen: boolean
  lyricsNotice: LyricsNotice
  setTab: (tab: Tab) => void
  openOverlay: (vizId: string) => void
  closeOverlay: () => void
  setSearchQuery: (q: string) => void
  setSelectedVizId: (id: string | null) => void
  setFullscreen: (v: boolean) => void
  setLibraryView: (v: LibraryView) => void
  setKaraokeOverlay: (v: boolean) => void
  toggleKaraokeOverlay: () => void
  setProfileOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setLyricsSearchOpen: (v: boolean) => void
  setLyricsNotice: (notice: LyricsNotice) => void
  cycleVisualizer: (direction: 'next' | 'prev', vizIds: string[]) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  currentTab: 'visualizers',
  overlayOpen: false,
  selectedVizId: null,
  searchQuery: '',
  isFullscreen: false,
  libraryView: 'list',
  karaokeOverlay: false,
  profileOpen: false,
  settingsOpen: false,
  lyricsSearchOpen: false,
  lyricsNotice: null,
  setTab: (tab) => set({ currentTab: tab }),
  openOverlay: (vizId) => set({ overlayOpen: true, selectedVizId: vizId }),
  closeOverlay: () => set({ overlayOpen: false, isFullscreen: false }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedVizId: (id) => set({ selectedVizId: id }),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setLibraryView: (v) => set({ libraryView: v }),
  setKaraokeOverlay: (v) => set({ karaokeOverlay: v }),
  toggleKaraokeOverlay: () => set((s) => ({ karaokeOverlay: !s.karaokeOverlay })),
  setProfileOpen: (v) => set({ profileOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setLyricsSearchOpen: (v) => set({ lyricsSearchOpen: v }),
  setLyricsNotice: (notice) => set({ lyricsNotice: notice }),
  cycleVisualizer: (direction, vizIds) => {
    if (vizIds.length === 0) return
    const current = get().selectedVizId
    const idx = current ? vizIds.indexOf(current) : -1
    const step = direction === 'next' ? 1 : -1
    const nextIdx = idx === -1 ? 0 : (idx + step + vizIds.length) % vizIds.length
    set({ selectedVizId: vizIds[nextIdx] })
  },
}))
