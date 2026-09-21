import { POSTER_HEIGHT, POSTER_WIDTH, A4_ASPECT } from '~/lib/constants'

/**
 * Tracks `.poster`'s actual pixel box so the chart is drawn at that exact size — matching
 * intrinsic to displayed size keeps summit labels and ridge strokes crisp instead of being
 * CSS-stretched from a small thumbnail.
 *
 * From sm upward, .poster (assets/css/main.css) grows to fill the card's full window height
 * and derives its own width from that via `aspect-ratio` — a size fixed by CSS independent of
 * what's drawn inside it.
 *
 * Below sm, .poster has no such externally-fixed size — it's sized BY its own content instead
 * (the compact mobile thumbnail). Feeding a measurement of that back in as the next plotHeight
 * would close a feedback loop: draw() always renders a bit taller than the plotHeight it's
 * given (label margin + relief overshoot), so each cycle inflates the height ~10% until it
 * blows past the browser's max SVG size. So only trust the measurement at sm and up, where the
 * box genuinely doesn't depend on it; below that, stay pinned to the fixed thumbnail size.
 */
export function useChartSize(posterEl: Ref<HTMLElement | null>) {
  const size = ref({ width: POSTER_WIDTH, height: POSTER_HEIGHT })

  onMounted(() => {
    const el = posterEl.value
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      if (window.innerWidth < 640) {
        size.value = { width: POSTER_WIDTH, height: POSTER_HEIGHT }
        return
      }
      // .poster's padding is asymmetric (more on top, for the caption) so its content box
      // isn't itself A4-shaped even though the padded box is — derive width from the measured
      // height via A4_ASPECT instead of trusting contentRect.width, or the chart (and the
      // exported poster) end up a different shape than the frame drawn on the map.
      const { width, height } = entry.contentRect
      if (width > 40 && height > 40) {
        size.value = { width: Math.round(height * A4_ASPECT), height: Math.round(height) }
      }
    })
    observer.observe(el)
    onUnmounted(() => observer.disconnect())
  })

  return size
}
