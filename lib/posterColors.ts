// Color presets for the artwork (background, ridge lines/labels, and the title/subtitle
// caption). The on-screen panel and the exported SVG/PNG/JPG read from the same scheme,
// so what you preview is what you export.
export interface PosterColorScheme {
  id: string
  name: string
  background: string
  /** Ridge lines, summit ticks, and the title (which sits in the same "ink" as the artwork). */
  line: string
  /** Halo drawn behind summit labels so they stay legible over whichever ridge is behind them. */
  outline: string
  subtitleText: string
}

export const POSTER_COLOR_SCHEMES: PosterColorScheme[] = [
  { id: 'midnight', name: 'Midnight', background: '#000000', line: '#ffffff', outline: '#000000', subtitleText: '#8a8a8a' },
  { id: 'parchment', name: 'Parchment', background: '#f4efe2', line: '#241d16', outline: '#f4efe2', subtitleText: '#6b6355' },
  { id: 'slate', name: 'Slate', background: '#1c2733', line: '#e7edf3', outline: '#1c2733', subtitleText: '#9fb1c2' },
  { id: 'forest', name: 'Forest', background: '#10231a', line: '#d8f0dd', outline: '#10231a', subtitleText: '#8fb89c' },
  { id: 'rust', name: 'Rust', background: '#2b140d', line: '#f4d9c6', outline: '#2b140d', subtitleText: '#c99a80' },
]

export const DEFAULT_POSTER_COLOR_SCHEME_ID = 'midnight'

export function posterColorScheme(id: string): PosterColorScheme {
  return POSTER_COLOR_SCHEMES.find((c) => c.id === id) ?? POSTER_COLOR_SCHEMES[0]!
}
