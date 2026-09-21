<script setup lang="ts">
// Port of app/frontend/src/components/MountainPicker.tsx.
import type { FocusOutsideEvent, PointerDownOutsideEvent } from 'reka-ui'
import { COUNTRIES, countryFlag, ZOOM } from '~/data/mountains'
import type { Peak, PeakSearchResult } from '~/types/ridgeline'

const numberFormat = new Intl.NumberFormat('en')
const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

function displayValue(value: { country: string; peak: Peak } | null): string {
  if (!value) return ''
  return value.country ? `${value.peak.name} · ${value.country}` : value.peak.name
}

const props = defineProps<{
  value: { country: string; peak: Peak } | null
}>()
const emit = defineEmits<{ select: [country: string, peak: Peak] }>()

const open = ref(false)
// null = showing the country list; a country name = drilled into that country's top 10
const drill = ref<string | null>(null)
const query = ref(displayValue(props.value))
const results = ref<PeakSearchResult[]>([])
const searchState = ref<'idle' | 'loading' | 'error'>('idle')
// Reka's "click outside closes the popover" logic only recognizes clicks as *inside* when they
// land on the anchor element (used instead of a Trigger, so positioning doesn't dictate when
// the popover opens) — PopoverContent's pointerDownOutside/focusOutside below check against
// this ref by hand to stop the very click that focuses the field from being treated as "outside".
const anchorEl = useTemplateRef<HTMLDivElement>('anchorEl')

// Whenever the popover closes, snap the field back to whatever is actually selected — so an
// abandoned search (closed without picking a result) doesn't leave stale text behind.
watch([() => props.value, open], () => {
  if (!open.value) query.value = displayValue(props.value)
})

const trimmedQuery = computed(() => query.value.trim())
const isOwnSelection = computed(() => trimmedQuery.value === displayValue(props.value) && trimmedQuery.value !== '')
const searching = computed(() => open.value && trimmedQuery.value.length >= MIN_QUERY_LENGTH && !isOwnSelection.value)

watch([searching, trimmedQuery], ([isSearching, q], _prev, onCleanup) => {
  if (!isSearching) {
    results.value = []
    searchState.value = 'idle'
    return
  }
  const controller = new AbortController()
  searchState.value = 'loading'
  const timer = setTimeout(async () => {
    try {
      const data = await searchPeaks(q, controller.signal)
      results.value = data.results
      searchState.value = 'idle'
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) searchState.value = 'error'
    }
  }, SEARCH_DEBOUNCE_MS)
  onCleanup(() => {
    clearTimeout(timer)
    controller.abort()
  })
})

function openChange(next: boolean) {
  open.value = next
  if (!next) drill.value = null // next open always starts back at the country list
}

function selectPeak(country: string, peak: Peak) {
  emit('select', country, peak)
  query.value = displayValue({ country, peak })
  open.value = false
}

function selectSearchResult(r: PeakSearchResult) {
  const peak: Peak = { name: r.name, lat: r.lat, lon: r.lon, elevation: r.elevation ?? 0, zoom: ZOOM }
  selectPeak(r.country ?? '', peak)
}

const drilledCountry = computed(() => (drill.value ? COUNTRIES.find((c) => c.country === drill.value) : null))

function onPointerDownOutside(e: PointerDownOutsideEvent) {
  if (anchorEl.value?.contains(e.detail.originalEvent.target as Node)) e.preventDefault()
}
function onFocusOutside(e: FocusOutsideEvent) {
  if (anchorEl.value?.contains(e.detail.originalEvent.target as Node)) e.preventDefault()
}
</script>

<template>
  <Popover :open="open" @update:open="openChange">
    <PopoverAnchor as-child>
      <div
        ref="anchorEl"
        class="flex h-11 w-full items-center gap-2 rounded-full bg-card px-4 shadow-elevation-1 outline-none transition-shadow has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/50 hover:shadow-elevation-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="shrink-0 text-muted-foreground" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4" />
          <path d="M11.2 11.2 14.5 14.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <input
          ref="inputEl"
          aria-label="Search any mountain, or browse by country"
          class="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Search any mountain…"
          :value="query"
          @input="
            (e: Event) => {
              query = (e.target as HTMLInputElement).value
              drill = null
              if (!open) open = true
            }
          "
          @focus="
            (e: FocusEvent) => {
              open = true
              ;(e.target as HTMLInputElement).select()
            }
          "
        />
      </div>
    </PopoverAnchor>

    <PopoverContent
      align="start"
      :side-offset="8"
      class="z-700 max-h-[min(70vh,420px)] w-(--reka-popper-anchor-width) overflow-y-auto rounded-xl bg-popover p-2 text-popover-foreground shadow-elevation-2"
      @open-auto-focus="(e: Event) => e.preventDefault()"
      @pointer-down-outside="onPointerDownOutside"
      @focus-outside="onFocusOutside"
    >
      <div v-if="searching" role="menu" aria-label="Search results">
        <p v-if="searchState === 'loading' && results.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
          Searching…
        </p>
        <p v-else-if="searchState === 'error'" class="px-3 py-2 text-xs text-destructive">Search failed. Try again.</p>
        <p v-else-if="searchState === 'idle' && results.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
          No mountains found.
        </p>
        <button
          v-for="(r, i) in results"
          :key="`${r.name}-${r.lat}-${r.lon}-${i}`"
          role="menuitem"
          class="flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left outline-none select-none hover:bg-accent focus-visible:bg-accent"
          @click="selectSearchResult(r)"
        >
          <span class="flex min-w-0 flex-col items-start">
            <span class="truncate text-sm text-foreground">{{ r.name }}</span>
            <span v-if="r.country" class="truncate text-xs text-muted-foreground">{{ r.country }}</span>
          </span>
          <span v-if="r.elevation != null" class="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
            {{ numberFormat.format(r.elevation) }} m
          </span>
        </button>
      </div>

      <div v-else-if="!drilledCountry" role="menu" aria-label="Countries">
        <button
          v-for="c in COUNTRIES"
          :key="c.country"
          role="menuitem"
          class="flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-sm text-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent"
          @click="drill = c.country"
        >
          <span class="flex items-center gap-3">
            <span class="text-base leading-none" aria-hidden="true">{{ countryFlag(c.code) }}</span>
            {{ c.country }}
          </span>
          <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
              <path d="M1 1l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </button>
      </div>

      <div v-else role="menu" :aria-label="`Top peaks in ${drilledCountry.country}`">
        <button
          class="mb-1 flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-xs font-medium text-muted-foreground outline-none select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
          @click="drill = null"
        >
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" aria-hidden="true">
            <path d="M5 1 1 5l4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ countryFlag(drilledCountry.code) }} {{ drilledCountry.country }}
        </button>
        <button
          v-for="peak in drilledCountry.peaks"
          :key="peak.name"
          role="menuitem"
          class="flex w-full items-center justify-between gap-2 rounded-lg py-2 pr-2 pl-3 text-left text-sm outline-none select-none hover:bg-accent focus-visible:bg-accent"
          @click="selectPeak(drilledCountry.country, peak)"
        >
          <span class="truncate text-foreground">{{ peak.name }}</span>
          <span class="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{{ numberFormat.format(peak.elevation) }} m</span>
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
