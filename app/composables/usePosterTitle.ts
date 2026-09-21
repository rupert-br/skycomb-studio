import { degrees } from '~/lib/format'
import type { RidgelinesResponse, Summit } from '~/types/ridgeline'

/**
 * The poster's title and subtitle. Until the user edits the title — or once they move to a
 * different rendered frame — it follows the highest summit of the frame on screen. Port of
 * the `displayTitle`/`subtitle` logic in App.tsx.
 */
export function usePosterTitle(result: Ref<RidgelinesResponse | null>, visibleSummits: Ref<Summit[]> | ComputedRef<Summit[]>) {
  // Pinned to the frame it was typed for, so switching to a different range drops it instead
  // of mislabelling the new poster forever.
  const customTitle = ref<{ key: string; text: string } | null>(null)
  const currentFrameKey = computed(() => (result.value ? frameKey(result.value.bbox) : null))

  const title = computed<string>({
    get: () =>
      (customTitle.value && customTitle.value.key === currentFrameKey.value ? customTitle.value.text : null) ??
      visibleSummits.value[0]?.name ??
      'Untitled range',
    set: (text) => {
      if (result.value) customTitle.value = { key: frameKey(result.value.bbox), text }
    },
  })

  const subtitle = computed(() => {
    if (!result.value) return ''
    const [west, south, east, north] = result.value.bbox
    return `${degrees((south + north) / 2, 'N', 'S')} · ${degrees((west + east) / 2, 'E', 'W')} · looking ${result.value.direction}`
  })

  return { title, subtitle }
}
