import { useEffect, useRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { Peak, PeakSearchResult } from '@/types'
import { COUNTRIES, ZOOM, countryFlag } from '@/data/mountains'
import { searchPeaks } from '@/api'

const numberFormat = new Intl.NumberFormat('en')
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

function displayValue(value: { country: string; peak: Peak } | null): string {
  if (!value) return ''
  return value.country ? `${value.peak.name} · ${value.country}` : value.peak.name
}

export function MountainPicker({
  value,
  onSelect,
}: {
  value: { country: string; peak: Peak } | null
  onSelect: (country: string, peak: Peak) => void
}) {
  const [open, setOpen] = useState(false)
  // null = showing the country list; a country name = drilled into that country's top 10
  const [drill, setDrill] = useState<string | null>(null)
  const [query, setQuery] = useState(() => displayValue(value))
  const [results, setResults] = useState<PeakSearchResult[]>([])
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  // Radix's "click outside closes the popover" logic only recognizes clicks as *inside* when
  // they land on a registered Trigger — we use Anchor instead (so positioning doesn't dictate
  // when the popover opens), so Content's onPointerDownOutside below checks against this ref
  // by hand to stop the very click that focuses the field from being treated as "outside".
  const anchorRef = useRef<HTMLDivElement>(null)

  // Whenever the popover closes, snap the field back to whatever is actually selected —
  // so an abandoned search (closed without picking a result) doesn't leave stale text behind.
  useEffect(() => {
    if (!open) setQuery(displayValue(value))
  }, [value, open])

  const trimmedQuery = query.trim()
  const isOwnSelection = trimmedQuery === displayValue(value) && trimmedQuery !== ''
  const searching = open && trimmedQuery.length >= MIN_QUERY_LENGTH && !isOwnSelection

  useEffect(() => {
    if (!searching) {
      setResults([])
      setSearchState('idle')
      return
    }
    const controller = new AbortController()
    setSearchState('loading')
    const timer = setTimeout(async () => {
      try {
        const data = await searchPeaks(trimmedQuery, controller.signal)
        setResults(data.results)
        setSearchState('idle')
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError')) setSearchState('error')
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // trimmedQuery is derived from `query`; `searching` already captures every input that should retrigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, trimmedQuery])

  function openChange(next: boolean) {
    setOpen(next)
    if (!next) setDrill(null) // next open always starts back at the country list
  }

  function selectPeak(country: string, peak: Peak) {
    onSelect(country, peak)
    setQuery(displayValue({ country, peak }))
    setOpen(false)
  }

  function selectSearchResult(r: PeakSearchResult) {
    const peak: Peak = { name: r.name, lat: r.lat, lon: r.lon, elevation: r.elevation ?? 0, zoom: ZOOM }
    selectPeak(r.country ?? '', peak)
  }

  const drilledCountry = drill
    ? COUNTRIES.find((c) => c.country === drill)
    : null

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={anchorRef}
          className='flex h-11 w-full items-center gap-2 rounded-full bg-card px-4 shadow-elevation-1 outline-none transition-shadow has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/50 hover:shadow-elevation-2'
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 16 16'
            fill='none'
            className='shrink-0 text-muted-foreground'
            aria-hidden='true'
          >
            <circle
              cx='7'
              cy='7'
              r='5.5'
              stroke='currentColor'
              strokeWidth='1.4'
            />
            <path
              d='M11.2 11.2 14.5 14.5'
              stroke='currentColor'
              strokeWidth='1.4'
              strokeLinecap='round'
            />
          </svg>
          <input
            ref={inputRef}
            aria-label='Search any mountain, or browse by country'
            className='min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
            placeholder='Search any mountain…'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setDrill(null)
              if (!open) setOpen(true)
            }}
            onFocus={(e) => {
              setOpen(true)
              e.target.select() // typing over a previous selection should replace it, not append
            }}
          />
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align='start'
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()} // the field already has focus; don't steal it
          onPointerDownOutside={(e) => {
            // The click that focuses the field fires *after* Content mounts and looks
            // "outside" to Radix (Anchor isn't a registered Trigger) — don't let it self-close.
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
          }}
          onFocusOutside={(e) => {
            // Same story as onPointerDownOutside, but for the focus event the click produces.
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault()
          }}
          className='z-700 max-h-[min(70vh,420px)] w-(--radix-popover-trigger-width) overflow-y-auto rounded-xl bg-popover p-2 text-popover-foreground shadow-elevation-2'
        >
          {searching ? (
            <div role='menu' aria-label='Search results'>
              {searchState === 'loading' && results.length === 0 && (
                <p className='px-3 py-2 text-xs text-muted-foreground'>Searching…</p>
              )}
              {searchState === 'error' && (
                <p className='px-3 py-2 text-xs text-destructive'>
                  Search failed — try again.
                </p>
              )}
              {searchState === 'idle' && results.length === 0 && (
                <p className='px-3 py-2 text-xs text-muted-foreground'>
                  No mountains found.
                </p>
              )}
              {results.map((r, i) => (
                <button
                  key={`${r.name}-${r.lat}-${r.lon}-${i}`}
                  role='menuitem'
                  onClick={() => selectSearchResult(r)}
                  className='flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left outline-none select-none hover:bg-accent focus-visible:bg-accent'
                >
                  <span className='flex min-w-0 flex-col items-start'>
                    <span className='truncate text-sm text-foreground'>{r.name}</span>
                    {r.country && (
                      <span className='truncate text-xs text-muted-foreground'>
                        {r.country}
                      </span>
                    )}
                  </span>
                  {r.elevation != null && (
                    <span className='shrink-0 font-mono text-xs text-muted-foreground tabular-nums'>
                      {numberFormat.format(r.elevation)} m
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : !drilledCountry ? (
            <div role='menu' aria-label='Countries'>
              {COUNTRIES.map((c) => (
                <button
                  key={c.country}
                  role='menuitem'
                  onClick={() => setDrill(c.country)}
                  className='flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-sm text-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent'
                >
                  <span className='flex items-center gap-3'>
                    <span className='text-base leading-none' aria-hidden='true'>
                      {countryFlag(c.code)}
                    </span>
                    {c.country}
                  </span>
                  <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <svg
                      width='6'
                      height='10'
                      viewBox='0 0 6 10'
                      fill='none'
                      aria-hidden='true'
                    >
                      <path
                        d='M1 1l4 4-4 4'
                        stroke='currentColor'
                        strokeWidth='1.3'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div
              role='menu'
              aria-label={`Top peaks in ${drilledCountry.country}`}
            >
              <button
                onClick={() => setDrill(null)}
                className='mb-1 flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-xs font-medium text-muted-foreground outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent'
              >
                <svg
                  width='6'
                  height='10'
                  viewBox='0 0 6 10'
                  fill='none'
                  aria-hidden='true'
                >
                  <path
                    d='M5 1 1 5l4 4'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
                {countryFlag(drilledCountry.code)} {drilledCountry.country}
              </button>
              {drilledCountry.peaks.map((peak) => (
                <button
                  key={peak.name}
                  role='menuitem'
                  onClick={() => selectPeak(drilledCountry.country, peak)}
                  className='flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-sm outline-none select-none hover:bg-accent focus-visible:bg-accent'
                >
                  <span className='truncate text-foreground'>{peak.name}</span>
                  <span className='shrink-0 font-mono text-xs text-muted-foreground tabular-nums'>
                    {numberFormat.format(peak.elevation)} m
                  </span>
                </button>
              ))}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
