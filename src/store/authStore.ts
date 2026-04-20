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
      token: null,
      user: null,
      avatarObjectUrl: null,
      storage: null,
      cloudAudioTrackIds: [],
      syncStatus: 'idle',
      syncMessage: null,
    })
  },

  restoreSession: async () => {
    const stored = readStoredAuth()
    if (!stored) return
    set({ token: stored.token, user: stored.user })
    try {
      const me = await cloudApi.fetchMe(stored.token)
      set({ user: me.user, storage: me.storage })
      await loadAvatarIntoStore(stored.token, Boolean(me.user.hasAvatar))
      await flushCloudPush(stored.token)
      await pullCloudSnapshot(stored.token)
      const meAfter = await cloudApi.fetchMe(stored.token)
      set({ user: meAfter.user, storage: meAfter.storage })
      await loadAvatarIntoStore(stored.token, Boolean(meAfter.user.hasAvatar))
      set({ syncStatus: 'ok', syncMessage: 'синхронизировано' })
    } catch {
      revokeAvatarUrl(get().avatarObjectUrl)
      persistAuth(null, null)
      set({
        token: null,
        user: null,
        avatarObjectUrl: null,
        storage: null,
        syncStatus: 'idle',
        syncMessage: null,
      })
    }
  },

  refreshMe: async () => {
    const token = get().token
    if (!token) return
    const me = await cloudApi.fetchMe(token)
    set({ user: me.user, storage: me.storage })
    await loadAvatarIntoStore(token, Boolean(me.user.hasAvatar))
  },

  uploadAvatar: async (file) => {
    const token = get().token
    if (!token) throw new Error('войди в аккаунт')
    if (!file.type.startsWith('image/')) {
      throw new Error('Выбери файл изображения (JPG, PNG, WebP, GIF)')
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Фото не больше 2 МБ')
    }
    const dataBase64 = await cloudApi.fileToBase64(file)
    await cloudApi.putProfileAvatar(token, file.type, dataBase64)
    const user = { ...get().user!, hasAvatar: true }
    set({ user })
    persistAuth(token, user)
    revokeAvatarUrl(get().avatarObjectUrl)
    const url = URL.createObjectURL(file)
    set({ avatarObjectUrl: url })
  },

  removeAvatar: async () => {
    const token = get().token
    if (!token) throw new Error('войди в аккаунт')
    await cloudApi.deleteProfileAvatar(token)
    revokeAvatarUrl(get().avatarObjectUrl)
    const user = { ...get().user!, hasAvatar: false }
    set({ user, avatarObjectUrl: null })
    persistAuth(token, user)
  },

  updateEmail: async (currentPassword, newEmail) => {
    const token = get().token
    if (!token) throw new Error('войди в аккаунт')
    const res = await cloudApi.updateAccountEmail(token, currentPassword, newEmail)
    persistAuth(res.token, res.user)
    set({ token: res.token, user: res.user })
  },

  updatePassword: async (currentPassword, newPassword) => {
    const token = get().token
    if (!token) throw new Error('войди в аккаунт')
    await cloudApi.updateAccountPassword(token, currentPassword, newPassword)
  },

  syncNow: async () => {
    const token = get().token
    if (!token) return
    set({ syncStatus: 'syncing', syncMessage: null })
    try {
      await flushCloudPush(token)
      await pullCloudSnapshot(token)
      const me = await cloudApi.fetchMe(token)
      set({ user: me.user, storage: me.storage })
      await loadAvatarIntoStore(token, Boolean(me.user.hasAvatar))
      set({ syncStatus: 'ok', syncMessage: 'синхронизировано' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ syncStatus: 'error', syncMessage: msg })
      throw e
    }
  },
}))

export function isLoggedIn(): boolean {
  return Boolean(useAuthStore.getState().token)
}
