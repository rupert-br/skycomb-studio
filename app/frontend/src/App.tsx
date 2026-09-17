import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ChevronLeft,
  SidePanelClose,
} from '@carbon/icons-react'
import { MapFrame } from '@/components/MapFrame'
import { MountainPicker } from '@/components/MountainPicker'
import {
  RidgelineChart,
  type ExportFormat,
  type RidgelineChartHandle,
} from '@/components/RidgelineChart'
import { fetchRidgelines, fetchSummits, frameKey } from '@/api'
import type { Bbox, Direction, Peak, RidgelinesResponse, Summit } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// Mirrors the backend limits in app/backend/main.py
const MAX_LON_SPAN = 2.0
const MAX_LAT_SPAN = 1.4

// ISO 216 A4 portrait (width:height = 1:√2) — the frame on the map and the poster
// preview both use it, so what you compose is the shape you'd actually print.
const A4_ASPECT = 1 / Math.SQRT2
const POSTER_WIDTH = 300
const POSTER_HEIGHT = Math.round(POSTER_WIDTH / A4_ASPECT)

const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west']
const ARROWS: Record<Direction, typeof ArrowUp> = {
  north: ArrowUp,
  east: ArrowRight,
  south: ArrowDown,
  west: ArrowLeft,
}

interface SummitsState {
  key: string // frame the list belongs to
  list: Summit[]
  note: string
}

const isAbortError = (e: unknown): boolean =>
  e instanceof Error && e.name === 'AbortError'
const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e)

const degrees = (v: number, pos: string, neg: string) =>
  `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`

function describe([west, south, east, north]: Bbox): string {
  const km =
    (east - west) * 111.32 * Math.cos((((south + north) / 2) * Math.PI) / 180)
  return `${degrees(south, 'N', 'S')}–${degrees(north, 'N', 'S')} · ${degrees(west, 'E', 'W')}–${degrees(east, 'E', 'W')} · ${Math.round(km)} km wide`
}

export default function App() {
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [selectedPeak, setSelectedPeak] = useState<{
    country: string
    peak: Peak
  } | null>(null)
  const [direction, setDirection] = useState<Direction>('north')
  const [lines, setLines] = useState(100)
  const [relief, setRelief] = useState(7)
  const [labels, setLabels] = useState(false)
  const [result, setResult] = useState<RidgelinesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summitsState, setSummitsState] = useState<SummitsState>({
    key: '',
    list: [],
    note: '',
  })
  // Pinned to the frame it was typed for, the same way summitsState is keyed by frame — so
  // switching to a different range drops it instead of mislabelling the new poster forever.
  const [customTitle, setCustomTitle] = useState<{
    key: string
    text: string
  } | null>(null)

  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpg')
  const [formatMenuOpen, setFormatMenuOpen] = useState(false)
  const [cardCollapsed, setCardCollapsed] = useState(false)

  // Morphs the minimized tab into the poster panel (and back) instead of the two swapping
  // instantly: both share `view-transition-name: ridgeline-panel` (globals.css), so the
  // browser interpolates position/size/radius between the outgoing and incoming element
  // itself. flushSync forces the DOM to update inside the callback, which the View
  // Transitions API needs to capture the "after" frame — without it React's async commit
  // would land after the browser already snapshotted the old state. Falls back to a plain
  // state update on browsers without the API (Firefox, older Safari).
  function toggleCardCollapsed(collapsed: boolean) {
    if (!document.startViewTransition) {
      setCardCollapsed(collapsed)
      return
    }
    // A transition the browser interrupts or skips (retriggered before the first finishes,
    // StrictMode's double-render in dev, reduced-motion, tab hidden, ...) rejects its
    // promises as an expected part of that, not a bug — left uncaught it's just console noise.
    const transition = document.startViewTransition(() =>
      flushSync(() => setCardCollapsed(collapsed)),
    )
    transition.updateCallbackDone.catch(() => {})
    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }

  const chartRef = useRef<RidgelineChartHandle>(null)
  const posterRef = useRef<HTMLDivElement>(null)
  const linesControllerRef = useRef<AbortController | undefined>(undefined)
  const summitsRequestRef = useRef<{
    key: string
    controller: AbortController
  } | null>(null) // only while a lookup is in flight
  const initialRenderDone = useRef(false)
  // Set whenever a mountain is picked from the search bar, so the bbox effect below knows
  // the next bbox update is a fly-to landing (not an unrelated pan/resize) and should render.
  const pendingSelectionRender = useRef(false)
  const skipDirectionLinesEffect = useRef(true)
  const ridgeLineChartVisible = useRef(true)

  // From sm upward, .poster (globals.css) grows to fill the card's full window height and
  // derives its own width from that via `aspect-ratio` — a size fixed by CSS independent of
  // what's drawn inside it. Track its actual pixel box so the chart is drawn at that exact
  // size — matching intrinsic to displayed size keeps summit labels and ridge strokes crisp
  // instead of being CSS-stretched from a small thumbnail.
  //
  // Below sm, .poster has no such externally-fixed size — it's sized BY its own content
  // instead (the compact mobile thumbnail). Feeding a measurement of that back in as the
  // next plotHeight would close a feedback loop: draw() always renders a bit taller than
  // the plotHeight it's given (label margin + relief overshoot), so each cycle inflates the
  // height ~10% until it blows past the browser's max SVG size. So only trust the
  // measurement at sm and up, where the box genuinely doesn't depend on it; below that,
  // stay pinned to the fixed thumbnail size.
  const [chartSize, setChartSize] = useState({
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
  })
  useEffect(() => {
    const el = posterRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (window.innerWidth < 640) {
        setChartSize({ width: POSTER_WIDTH, height: POSTER_HEIGHT })
        return
      }
      // .poster's padding is asymmetric (more on top, for the caption) so its content box
      // isn't itself A4-shaped even though the padded box is — derive width from the
      // measured height via A4_ASPECT instead of trusting contentRect.width, or the chart
      // (and the exported poster) end up a different shape than the frame drawn on the map.
      const { width, height } = entry.contentRect
      if (width > 40 && height > 40)
        setChartSize({
          width: Math.round(height * A4_ASPECT),
          height: Math.round(height),
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const areaTooLarge =
    !!bbox &&
    (bbox[2] - bbox[0] > MAX_LON_SPAN || bbox[3] - bbox[1] > MAX_LAT_SPAN)

  // Only label the chart with summits of the frame it actually shows
  const visibleSummits = useMemo(
    () =>
      result && summitsState.key === frameKey(result.bbox)
        ? summitsState.list
        : [],
    [result, summitsState],
  )

  // Until the user edits it — or once they move to a different rendered frame — the title
  // follows the highest summit of the frame on screen
  const currentFrameKey = result ? frameKey(result.bbox) : null
  const displayTitle =
    (customTitle && customTitle.key === currentFrameKey
      ? customTitle.text
      : null) ??
    visibleSummits[0]?.name ??
    'Untitled range'

  const subtitle = useMemo(() => {
    if (!result) return ''
    const [west, south, east, north] = result.bbox
    return `${degrees((south + north) / 2, 'N', 'S')} · ${degrees((west + east) / 2, 'E', 'W')} · looking ${result.direction}`
  }, [result])

  async function loadSummits(frame: Bbox) {
    const key = frameKey(frame)
    const loaded = summitsState.key === key && !summitsState.note
    if (loaded || summitsRequestRef.current?.key === key) return

    summitsRequestRef.current?.controller.abort()
    const request = { key, controller: new AbortController() }
    summitsRequestRef.current = request
    setSummitsState({ key: '', list: [], note: '' })
    try {
      const data = await fetchSummits(frame, request.controller.signal)
      // An error note leaves `loaded` false, so the next render retries
      setSummitsState({ key, list: data.summits, note: data.error ?? '' })
    } catch (e) {
      // Stay quiet only when we cancelled it ourselves; anything else is retried on the next render
      if (!request.controller.signal.aborted)
        setSummitsState({ key, list: [], note: errorMessage(e) })
    } finally {
      if (summitsRequestRef.current === request)
        summitsRequestRef.current = null
    }
  }

  async function render() {
    if (!bbox || areaTooLarge) return
    const frame = bbox
    loadSummits(frame) // in parallel; labels appear when they arrive

    linesControllerRef.current?.abort()
    const current = new AbortController()
    linesControllerRef.current = current
    setLoading(true)
    setError('')
    try {
      const data = await fetchRidgelines(
        { bbox: frame, lines, samples: Math.round(lines * 8), direction },
        current.signal,
      )
      setResult(data)
    } catch (e) {
      if (!isAbortError(e)) setError(errorMessage(e))
    } finally {
      if (linesControllerRef.current === current) setLoading(false)
    }
  }

  // The first frame renders automatically; later bbox changes only render again when they
  // land a mountain picked from the search bar (an unrelated pan/resize should not re-render).
  useEffect(() => {
    if (
      bbox &&
      (!initialRenderDone.current || pendingSelectionRender.current)
    ) {
      initialRenderDone.current = true
      pendingSelectionRender.current = false
      render()
    }
    // render() intentionally omitted: it always reads the latest state via closure,
    // and listing it would re-run this effect on every unrelated state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox])

  useEffect(() => {
    if (skipDirectionLinesEffect.current) {
      skipDirectionLinesEffect.current = false
      return
    }
    if (result) render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, lines])

  return (
    <div className='fixed inset-0 overflow-hidden bg-background text-foreground max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:overflow-y-auto'>
      {/* On mobile the map only needs a positioned box of its own (`.map-wrap` inside MapFrame
          fills whatever ancestor establishes the containing block); `sm:contents` drops that
          box from layout above the breakpoint so the map goes back to filling the whole screen,
          exactly like before this became a flex column. */}
      <div className='max-sm:relative max-sm:h-[40vh] max-sm:shrink-0 sm:contents'>
        <MapFrame
          target={selectedPeak?.peak ?? null}
          aspect={A4_ASPECT}
          onBboxChange={setBbox}
          onPeakSelect={(country, peak) => {
            pendingSelectionRender.current = true
            setSelectedPeak({ country, peak })
          }}
          renderedFrame={result?.bbox ?? null}
        />
      </div>

      {/* Mountain-range search: floats top-left from sm upward like Google Maps' own search
          bar — no card behind it, the pill itself is the only surface. Stacks in normal flow
          on mobile so it can never sit under the result card. */}
      <div className='z-[600] max-sm:mx-4 sm:absolute sm:top-4 sm:left-4 sm:w-[min(92vw,320px)]'>
        <MountainPicker
          value={selectedPeak}
          onSelect={(country, peak) => {
            pendingSelectionRender.current = true
            setSelectedPeak({ country, peak })
          }}
        />
      </div>

      {/* Ridgeline result: from sm upward this spans the window height (top-28 to
          bottom-4) and sizes to its content's width, so the poster itself — not just a
          thumbnail of it — can grow to fill the window. The top offset is taller than the
          search bar's (top-4) so the card clears mapboxgl's top-right zoom/compass control
          instead of covering it. Stacks in flow below the nav card on mobile instead, where
          the whole column (not this card alone) scrolls.
          Collapsible: collapsing swaps the card for a slim tab sized to its label, not
          stretched to the card's full height/width, so the map reclaims the rest of that
          space. Label rotates 90° on desktop; mobile has no vertical room for that, so it
          stays a small upright pill instead. */}
      {cardCollapsed ? (
        <button
          type='button'
          onClick={() => toggleCardCollapsed(false)}
          aria-label='Show ridgeline poster panel'
          className='ridgeline-panel-morph z-[600] flex w-fit items-center justify-center gap-1.5 self-start rounded-xl bg-card text-xs font-medium tracking-wide text-foreground shadow-elevation-2 hover:bg-muted max-sm:mx-4 max-sm:mb-4 max-sm:h-10 max-sm:px-4 sm:absolute sm:top-1/2 sm:right-4 sm:h-fit sm:-translate-y-1/2 sm:flex-col sm:gap-2 sm:px-2 sm:py-3'
        >
          <ChevronLeft size={14} className='max-sm:hidden' />
          <span className='max-sm:hidden [writing-mode:vertical-rl] rotate-180'>
            Ridgeline poster
          </span>
          <span className='sm:hidden'>Show ridgeline poster</span>
        </button>
      ) : (
        <Card className='ridgeline-panel-morph z-[600] max-sm:mx-4 max-sm:mb-4 sm:absolute sm:top-28 sm:right-4 sm:bottom-4 sm:w-fit sm:min-w-[260px] sm:max-w-[min(92vw,720px)] sm:overflow-y-auto'>
          <CardContent className='sm:h-full sm:min-h-0'>
            <div className='flex justify-end'>
              <Button
                type='button'
                onClick={() => toggleCardCollapsed(true)}
                aria-label='Minimize ridgeline poster panel'
                className='flex shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
              >
                Minimize
              </Button>
            </div>
            <div className='poster' ref={posterRef}>
              {result ? (
                <RidgelineChart
                  ref={chartRef}
                  data={result}
                  summits={visibleSummits}
                  relief={relief}
                  labels={labels}
                  width={chartSize.width}
                  plotHeight={chartSize.height}
                />
              ) : !loading ? (
                <p className='m-0 text-xs text-muted-foreground'>
                  Move the map, then press “Render this area”.
                </p>
              ) : null}
              {loading && (
                <div className='poster-loading text-white'>
                  Sampling terrain…
                </div>
              )}
            </div>

            {result && (
              <div className='poster-caption text-center'>
                <input
                  value={displayTitle}
                  onChange={(e) =>
                    setCustomTitle({
                      key: frameKey(result.bbox),
                      text: e.target.value,
                    })
                  }
                  placeholder='Title'
                  aria-label='Poster title'
                />
                <p className='mt-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground'>
                  {subtitle}
                </p>
              </div>
            )}

            <div className='grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground'>
              <span>Looking</span>
              <ToggleGroup
                type='single'
                value={direction}
                onValueChange={(v) => v && setDirection(v as Direction)}
              >
                {DIRECTIONS.map((d) => {
                  const Icon = ARROWS[d]
                  return (
                    <ToggleGroupItem
                      key={d}
                      value={d}
                      size='sm'
                      aria-label={`Looking ${d}`}
                    >
                      <Icon size={16} /> {d}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>

              <Label htmlFor='lines'>Lines · {lines}</Label>
              <Slider
                id='lines'
                defaultValue={[lines]}
                min={40}
                max={200}
                step={10}
                onValueCommit={([v]) => setLines(v)}
              />

              <Label htmlFor='relief'>Relief · {relief}</Label>
              <Slider
                id='relief'
                value={[relief]}
                min={1}
                max={16}
                step={0.5}
                onValueChange={([v]) => setRelief(v)}
              />

              <span>Labels</span>
              <div className='flex flex-wrap items-center gap-2'>
                <Switch
                  id='labels'
                  checked={labels}
                  onCheckedChange={setLabels}
                />
                <Label htmlFor='labels' className='cursor-pointer'>
                  Summit names
                </Label>
                {summitsState.note && (
                  <span className='text-amber-600'>· {summitsState.note}</span>
                )}
              </div>
            </div>

            {areaTooLarge && (
              <p className='m-0 text-xs text-amber-600'>
                Zoom in: the frame covers more than {MAX_LON_SPAN}° ×{' '}
                {MAX_LAT_SPAN}°.
              </p>
            )}
            {error && <p className='m-0 text-sm text-destructive'>{error}</p>}

            <div className='flex items-center justify-between gap-2'>
              <Button
                variant='default'
                disabled={!bbox || areaTooLarge || loading}
                onClick={render}
              >
                {loading ? 'Rendering…' : 'Render this area'}
              </Button>
              <div className='inline-flex'>
                <Button
                  disabled={!result}
                  className='rounded-r-none'
                  onClick={() =>
                    chartRef.current?.download(
                      displayTitle,
                      subtitle,
                      exportFormat,
                    )
                  }
                >
                  Download {exportFormat.toUpperCase()}
                </Button>

                <PopoverPrimitive.Root
                  open={formatMenuOpen}
                  onOpenChange={setFormatMenuOpen}
                >
                  <PopoverPrimitive.Trigger asChild>
                    <Button
                      disabled={!result}
                      aria-label='Choose download format'
                      className='w-8 rounded-l-none border-l border-border px-0'
                    >
                      <svg
                        width='10'
                        height='6'
                        viewBox='0 0 10 6'
                        fill='none'
                        className={`shrink-0 transition-transform ${formatMenuOpen ? 'rotate-180' : ''}`}
                        aria-hidden='true'
                      >
                        <path
                          d='M1 1l4 4 4-4'
                          stroke='currentColor'
                          strokeWidth='1.3'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </Button>
                  </PopoverPrimitive.Trigger>

                  <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                      align='end'
                      sideOffset={8}
                      className='z-[700] w-32 overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-elevation-2'
                    >
                      <div role='menu' aria-label='Download format'>
                        {(['jpg', 'png', 'svg'] as const).map((format) => (
                          <button
                            key={format}
                            role='menuitem'
                            onClick={() => {
                              setExportFormat(format)
                              setFormatMenuOpen(false)
                              chartRef.current?.download(
                                displayTitle,
                                subtitle,
                                format,
                              )
                            }}
                            className='flex w-full items-center justify-between gap-2 rounded-lg py-1.5 px-2.5 text-left text-sm text-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent'
                          >
                            {format.toUpperCase()}
                            {format === exportFormat && (
                              <svg
                                width='12'
                                height='10'
                                viewBox='0 0 12 10'
                                fill='none'
                                aria-hidden='true'
                              >
                                <path
                                  d='M1 5l3.5 3.5L11 1'
                                  stroke='currentColor'
                                  strokeWidth='1.5'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverPrimitive.Content>
                  </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
              </div>
            </div>

            {result && (
              <p className='m-0 font-mono text-[11px] text-muted-foreground tabular-nums'>
                zoom {result.meta.zoom} · {result.meta.tiles} tiles ·{' '}
                {result.meta.metres_per_px} m/px · {result.meta.elapsed_ms} ms
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
