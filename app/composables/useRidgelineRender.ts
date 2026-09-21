// The render pipeline: frame -> ridgelines + summits. Pulled out of the page component
// (unlike App.tsx, where this and the DOM lived in one 560-line file) so it's testable and
// readable on its own. Port of App.tsx's render()/loadSummits() and their effects.
import { MAX_LAT_SPAN, MAX_LON_SPAN } from '~/lib/constants'
import type { Bbox, Direction, RidgelinesResponse, Summit } from '~/types/ridgeline'

interface SummitsState {
  key: string // frame the list belongs to
  list: Summit[]
  note: string
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}
function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function useRidgelineRender() {
  const bbox = ref<Bbox | null>(null)
  const direction = ref<Direction>('north')
  const lines = ref(100)
  const result = ref<RidgelinesResponse | null>(null)
  const loading = ref(false)
  const error = ref('')
  const summitsState = ref<SummitsState>({ key: '', list: [], note: '' })

  // Plain (non-reactive) bookkeeping — mirrors the useRef() values in App.tsx that never
  // needed to trigger a re-render themselves, only to coordinate the async flow below.
  let linesController: AbortController | undefined
  let summitsRequest: { key: string; controller: AbortController } | null = null
  let initialRenderDone = false
  // Set whenever a mountain is picked from the search bar, so the bbox watcher below knows
  // the next bbox update is a fly-to landing (not an unrelated pan/resize) and should render.
  let pendingSelectionRender = false
  let skipDirectionLinesWatch = true

  const areaTooLarge = computed(() => {
    const b = bbox.value
    return !!b && (b[2] - b[0] > MAX_LON_SPAN || b[3] - b[1] > MAX_LAT_SPAN)
  })

  // Only label the chart with summits of the frame it actually shows
  const visibleSummits = computed(() =>
    result.value && summitsState.value.key === frameKey(result.value.bbox) ? summitsState.value.list : [],
  )

  async function loadSummits(frame: Bbox) {
    const key = frameKey(frame)
    const loaded = summitsState.value.key === key && !summitsState.value.note
    if (loaded || summitsRequest?.key === key) return

    summitsRequest?.controller.abort()
    const request = { key, controller: new AbortController() }
    summitsRequest = request
    summitsState.value = { key: '', list: [], note: '' }
    try {
      const data = await fetchSummits(frame, request.controller.signal)
      // An error note leaves `loaded` false, so the next render retries
      summitsState.value = { key, list: data.summits, note: data.error ?? '' }
    } catch (e) {
      // Stay quiet only when we cancelled it ourselves; anything else is retried on the next render
      if (!request.controller.signal.aborted) summitsState.value = { key, list: [], note: errorMessage(e) }
    } finally {
      if (summitsRequest === request) summitsRequest = null
    }
  }

  async function render() {
    if (!bbox.value || areaTooLarge.value) return
    const frame = bbox.value
    loadSummits(frame) // in parallel; labels appear when they arrive

    linesController?.abort()
    const current = new AbortController()
    linesController = current
    loading.value = true
    error.value = ''
    try {
      const data = await fetchRidgelines(
        { bbox: frame, lines: lines.value, samples: Math.round(lines.value * 8), direction: direction.value },
        current.signal,
      )
      result.value = data
    } catch (e) {
      if (!isAbortError(e)) error.value = errorMessage(e)
    } finally {
      if (linesController === current) loading.value = false
    }
  }

  /** Call when a mountain is picked from search/markers, right before the map flies there. */
  function markPendingSelection() {
    pendingSelectionRender = true
  }

  // The first frame renders automatically; later bbox changes only render again when they
  // land a mountain picked from the search bar (an unrelated pan/resize should not re-render).
  watch(bbox, () => {
    if (bbox.value && (!initialRenderDone || pendingSelectionRender)) {
      initialRenderDone = true
      pendingSelectionRender = false
      render()
    }
  })

  watch([direction, lines], () => {
    if (skipDirectionLinesWatch) {
      skipDirectionLinesWatch = false
      return
    }
    if (result.value) render()
  })

  return {
    bbox,
    direction,
    lines,
    result,
    loading,
    error,
    summitsState,
    areaTooLarge,
    visibleSummits,
    render,
    markPendingSelection,
  }
}
