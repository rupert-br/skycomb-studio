<script setup lang="ts">
// The poster tool. Port of app/frontend/src/App.tsx — thinned out considerably since the
// render pipeline (useRidgelineRender), the title/subtitle logic (usePosterTitle) and the
// collapse animation (usePosterCard) all moved into composables, and the card markup moved
// into PosterPanel.vue.
import { ArrowLeft } from '@lucide/vue'
import { A4_ASPECT } from '~/lib/constants'
import { DEFAULT_POSTER_COLOR_SCHEME_ID, posterColorScheme } from '~/lib/posterColors'
import type { Peak } from '~/types/ridgeline'

useHead({ title: 'Skycomb Studio' })

const { bbox, direction, lines, result, loading, error, summitsState, areaTooLarge, visibleSummits, render, markPendingSelection } =
  useRidgelineRender()
const { title, subtitle } = usePosterTitle(result, visibleSummits)
const { collapsed, toggle: toggleCollapsed } = usePosterCard()

// Purely client-side restyling — never triggers a re-render of the ridgelines themselves,
// so these stay outside useRidgelineRender's direction/lines watcher.
const relief = ref(7)
const labels = ref(false)
const colorSchemeId = ref(DEFAULT_POSTER_COLOR_SCHEME_ID)
const showText = ref(true)
const transparentBackground = ref(false)

const selectedPeak = ref<{ country: string; peak: Peak } | null>(null)
const summitsNote = computed(() => summitsState.value.note)
const canRender = computed(() => !!bbox.value && !areaTooLarge.value)
const colorScheme = computed(() => posterColorScheme(colorSchemeId.value))

function onPeakSelect(country: string, peak: Peak) {
  markPendingSelection()
  selectedPeak.value = { country, peak }
}
</script>

<template>
  <div
    class="fixed inset-0 overflow-hidden bg-background text-foreground max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:overflow-y-auto"
  >
    <!-- Mountain-range search: floats top-left over the map like Google Maps' own search bar,
         at every breakpoint (the outer `fixed inset-0` div is the containing block). The back
         link sits to its left as a matching round chip rather than inside the header, since
         this page has no header — the map fills the screen. -->
    <div class="absolute top-4 right-4 left-4 z-[600] flex items-center gap-2 sm:right-auto sm:w-[min(92vw,320px)]">
      <NuxtLink
        to="/"
        aria-label="Back to home"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-elevation-1 outline-none transition-shadow hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ArrowLeft :size="18" />
      </NuxtLink>
      <div class="min-w-0 flex-1">
        <MountainPicker :value="selectedPeak" @select="onPeakSelect" />
      </div>
    </div>

    <!-- On mobile the map only needs a positioned box of its own (`.map-wrap` inside MapFrame
         fills whatever ancestor establishes the containing block); `sm:contents` drops that
         box from layout above the breakpoint so the map goes back to filling the whole screen. -->
    <div class="max-sm:relative max-sm:h-[40vh] max-sm:shrink-0 sm:contents">
      <MapFrame
        :target="selectedPeak?.peak ?? null"
        :aspect="A4_ASPECT"
        :result="result"
        :summits="visibleSummits"
        :relief="relief"
        :labels="labels"
        :color-scheme="colorScheme"
        @bbox-change="(b) => (bbox = b)"
        @peak-select="onPeakSelect"
      />
    </div>

    <PosterPanel
      v-model:direction="direction"
      v-model:lines="lines"
      v-model:relief="relief"
      v-model:labels="labels"
      v-model:title="title"
      v-model:color-scheme-id="colorSchemeId"
      v-model:show-text="showText"
      v-model:transparent-background="transparentBackground"
      :collapsed="collapsed"
      :result="result"
      :loading="loading"
      :error="error"
      :area-too-large="areaTooLarge"
      :can-render="canRender"
      :visible-summits="visibleSummits"
      :summits-note="summitsNote"
      :subtitle="subtitle"
      @update:collapsed="toggleCollapsed"
      @render="render"
    />
  </div>
</template>
