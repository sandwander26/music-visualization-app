const PREVIEW_MODULES = import.meta.glob<string>('../assets/previews/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const PREVIEW_MAP: Record<string, string> = {}
for (const [path, url] of Object.entries(PREVIEW_MODULES)) {
  const match = path.match(/\/([^/]+)\.jpg$/)
  if (match) {
    PREVIEW_MAP[match[1]] = url
  }
}

export function getStaticPreviewUrl(vizId: string): string | null {
  return PREVIEW_MAP[vizId] ?? null
}

export function hasStaticPreview(vizId: string): boolean {
  return vizId in PREVIEW_MAP
}
