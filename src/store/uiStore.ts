import { create } from 'zustand'

type Tab = 'gallery' | 'library'

interface UIState {
  currentTab: Tab
  setTab: (t: Tab) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  selectedVizId: string | null
  setSelectedVizId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  currentTab: 'gallery',
  setTab: (currentTab) => set({ currentTab }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  selectedVizId: null,
  setSelectedVizId: (selectedVizId) => set({ selectedVizId }),
}))
