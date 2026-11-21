import type { InkMethod, MangaPanelData, MangaStoryboard } from '../types/manga'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const mangaApiBase = (import.meta.env.VITE_MANGA_API_BASE_URL || '').replace(/\/$/, '')

export function backendUrl(path: string) {
  return apiBase + path
}

export function mediaUrl(path: string) {
  if (path.startsWith('/api/media/')) return mangaBackendUrl(path)
  return path.startsWith('/assets/') ? backendUrl(path) : path
}

export function mangaBackendUrl(path: string) {
  return mangaApiBase + path
}

export function formatTime(seconds: number) {
  const tenths = Math.round(Math.max(0, seconds) * 10)
  const minutes = Math.floor(tenths / 600).toString().padStart(2, '0')
  const remainder = ((tenths % 600) / 10).toFixed(1).padStart(4, '0')
  return minutes + ':' + remainder
}

export const humanize = (value: string) => value.replaceAll('_', ' ')
export const pct = (value: number) => Math.round(value * 100) + '%'
const inkLabels: Record<InkMethod, string> = {
  opencv_deterministic: 'OpenCV · deterministic',
  nano_banana_verified: 'Nano Banana · verified',
  hybrid: 'Frame and SVG overlay',
  frame_guided: 'Frame-guided ink',
  svg_vector: 'Vector illustration',
}
export const inkLabel = (method: InkMethod) => inkLabels[method]

export const sortPanels = (panels: MangaPanelData[]) => [...panels].sort((a, b) => a.reading_order - b.reading_order)

export function storyboardPanels(story: MangaStoryboard) {
  return [...story.pages]
    .sort((a, b) => a.page_number - b.page_number)
    .flatMap((page) => sortPanels(page.panels))
}
