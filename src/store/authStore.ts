import { create } from 'zustand'
import * as cloudApi from '../services/cloudApi'
import { flushCloudPush, pullCloudSnapshot } from '../services/cloudSync'

const AUTH_STORAGE_KEY = 'mv_auth_v1'

export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  hasAvatar?: boolean
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  
  avatarObjectUrl: string | null
  storage: cloudApi.StorageInfo | null
  
  cloudAudioTrackIds: string[]
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error'
  syncMessage: string | null
  setCloudAudioTrackIds: (ids: string[]) => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
  refreshMe: () => Promise<void>
  syncNow: () => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  removeAvatar: () => Promise<void>
  updateEmail: (currentPassword: string, newEmail: string) => Promise<void>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

function revokeAvatarUrl(url: string | null): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

async function loadAvatarIntoStore(token: string, hasAvatar: boolean): Promise<void> {
  const prev = useAuthStore.getState().avatarObjectUrl
  revokeAvatarUrl(prev)
  if (!hasAvatar) {
    useAuthStore.setState({ avatarObjectUrl: null })
    return
  }
  try {
    const url = await cloudApi.fetchProfileAvatarObjectUrl(token)
    useAuthStore.setState({ avatarObjectUrl: url })
  } catch (err) {
    console.warn('[auth] avatar load:', err)
    useAuthStore.setState({ avatarObjectUrl: null })
  }
}

function readStoredAuth(): { token: string; user: AuthUser } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { token?: string; user?: AuthUser }
    if (!o.token || !o.user?.id || !o.user.email) return null
    return { token: o.token, user: o.user }
  } catch {
    return null
  }
}

function persistAuth(token: string | null, user: AuthUser | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!token || !user) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }))
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  avatarObjectUrl: null,
  storage: null,
  cloudAudioTrackIds: [],
  syncStatus: 'idle',
  syncMessage: null,

  setCloudAudioTrackIds: (ids) => set({ cloudAudioTrackIds: ids }),

  login: async (email, password) => {
    const res = await cloudApi.login(email, password)
    persistAuth(res.token, res.user)
    set({ token: res.token, user: res.user, syncStatus: 'syncing', syncMessage: null })
    await get().syncNow()
  },

  register: async (email, password, displayName) => {
    const res = await cloudApi.register(email, password, displayName)
    persistAuth(res.token, res.user)
    set({ token: res.token, user: res.user, syncStatus: 'syncing', syncMessage: null })
    await get().syncNow()
  },

  logout: () => {
    revokeAvatarUrl(get().avatarObjectUrl)
    persistAuth(null, null)
    set({