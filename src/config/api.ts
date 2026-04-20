
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  const base = (raw ?? 'http://127.0.0.1:8787').replace(/\/$/, '')
  return base
}

export function isCloudApiConfigured(): boolean {
  return getApiBaseUrl().length > 0
}
