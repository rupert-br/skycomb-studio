<script setup lang="ts">
// Landing page — SSR'd (unlike /studio). The hero's ridgeline art is synthetic (HeroRidgeline.vue
// generates it from fixed math, not a real frame) so this page never needs Mapbox or the terrain
// pipeline just to look like the studio.
import {
  ArrowRight,
  Compass,
  Database,
  Globe,
  Layers,
  MapPin,
  Palette,
  Plus,
  Rows3,
  SlidersHorizontal,
} from '@lucide/vue'
import { COUNTRIES, countryFlag, peaksGeoJSON } from '~/data/mountains'

useHead({ title: 'Skycomb Studio' })
useSeoMeta({
  title: 'Skycomb Studio: turn any mountain into ridgelines',
  description:
    "Frame any mountain range on a map, or start from a summit that's already loaded, and turn its terrain into an Unknown Pleasures style ridgeline drawing.",
})

const peakCount = peaksGeoJSON().features.length
const countryCount = COUNTRIES.length

const STEPS = [
  {
    icon: Compass,
    title: 'Frame',
    text: `Search any summit, pick one of ${peakCount}+ ready-made peaks across ${countryCount} countries, or just drag the frame over the map yourself.`,
  },
  {
    icon: Layers,
    title: 'Render',
    text: 'The server samples real elevation data into stacked ridgelines, the far skyline first and everything nearer after.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Tune',
    text: 'Viewing direction, line count, relief and summit labels are all instant client-side restyling, so nothing re-renders the terrain.',
  },
]

// Numbers mirror server/utils/dem.ts and the ridgelines API limits (see CONCEPT.md).
const STATS = [
  { value: 'Worldwide', label: 'terrain coverage: frame any range on Earth' },
  { value: `${peakCount}+`, label: `ready-made peaks in ${countryCount} countries` },
  { value: '~12 m', label: 'best terrain resolution' },
  { value: '240', label: 'lines at most per design' },
]

const FEATURES = [
  {
    icon: Globe,
    title: 'Real terrain, anywhere',
    text: 'Every line is sampled from public elevation tiles for the area you framed. Sharp summits stay sharp, and a broad valley stays broad.',
  },
  {
    icon: MapPin,
    title: 'Named summits',
    text: 'Peak names and heights come from OpenStreetMap and are snapped to the nearest drawn ridge, so each label sits right on its peak.',
  },
  {
    icon: Compass,
    title: 'Four viewing directions',
    text: 'Look north, east, south or west across the same terrain. Every direction is a different skyline of the same mountain.',
  },
  {
    icon: Rows3,
    title: 'From bold to fine',
    text: 'Draw anywhere from 16 to 240 lines: a few graphic ridges, or a dense drawing with every fold of the massif.',
  },
  {
    icon: Palette,
    title: 'Your palette',
    text: 'Five color schemes, adjustable relief, your own title. Changes apply instantly, without re-fetching any terrain.',
  },
  {
    icon: Database,
    title: 'Built on open data',
    text: 'Elevation comes from AWS Terrain Tiles and summit names from OpenStreetMap, both open datasets available to everyone.',
  },
]

const FAQ = [
  {
    q: 'Where in the world can I use it?',
    a: 'Anywhere with a mountain to draw. Elevation data covers the whole globe, and a single frame can span roughly 150 km at Alpine latitudes, enough for a whole massif.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Elevation comes from AWS Terrain Tiles, an open compilation of SRTM, Copernicus and national datasets. Summit names come from OpenStreetMap (© OpenStreetMap contributors, ODbL).',
  },
  {
    q: 'Do I need an account?',
    a: 'No. The studio opens straight away, no sign-up needed. Accounts are planned so you can save your designs.',
  },
  {
    q: 'How long does a render take?',
    a: 'A few seconds for an area the studio has not seen before, while the terrain tiles load. After that, changing direction, line count or relief is nearly instant.',
  },
]
</script>

<template>
  <main class="bg-background text-foreground">
    <SiteHeader />

    <!-- Hero: the one full-bleed black moment on the page — the studio's default artwork is black
         with white ridgelines (see .poster in main.css), so the hero borrows that exact palette
         instead of introducing a second visual language just for marketing. -->
    <section
      class="relative -mt-[68px] flex min-h-[92vh] items-end overflow-hidden bg-black pt-[68px] text-white sm:min-h-[86vh]"
    >
      <div class="absolute inset-0">
        <HeroRidgeline class="opacity-90" />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black via-black/70 via-60% to-transparent"
        />
        <div
          class="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent to-25%"
        />
      </div>

      <div
        class="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 sm:pb-24"
      >
        <h1
          class="max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-6xl"
        >
          Turn any mountain into something special.
        </h1>
        <p class="max-w-xl text-balance text-sm text-white/70 sm:text-base">
          Frame a range on the map, or start from a summit that's already
          loaded, and watch its terrain rise into an Unknown&nbsp;Pleasures
          style drawing. Tune it until it looks just right.
        </p>
        <div class="flex flex-wrap items-center gap-4 pt-2">
          <Button as-child variant="default">
            <NuxtLink to="/studio" class="gap-1.5">
              Open the studio
              <ArrowRight :size="14" />
            </NuxtLink>
          </Button>
          <a
            href="#how-it-works"
            class="text-sm text-white/70 underline underline-offset-4 hover:text-white"
          >
            See how it works
          </a>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <div class="mb-10 max-w-xl sm:mb-14">
        <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
          From a frame on a map to a drawing made of lines.
        </h2>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <Card v-for="(step, i) in STEPS" :key="step.title" class="gap-4 p-5">
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
            >
              <component :is="step.icon" :size="16" />
            </div>
            <span class="font-mono text-xs text-muted-foreground tabular-nums"
              >0{{ i + 1 }}</span
            >
          </div>
          <div>
            <h3
              class="mb-1.5 font-display text-lg tracking-tight text-card-foreground"
            >
              {{ step.title }}
            </h3>
            <p class="text-sm text-muted-foreground">{{ step.text }}</p>
          </div>
        </Card>
      </div>

      <!-- The predefined-peak catalog, as a flag chip cloud rather than a second full section —
           it's supporting detail for step 1 ("Frame"), not a separate idea. -->
      <div class="mt-10 flex flex-wrap items-center gap-2 sm:mt-14">
        <span class="mr-1 text-xs text-muted-foreground">Ready to go:</span>
        <span
          v-for="c in COUNTRIES"
          :key="c.country"
          class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
        >
          <span aria-hidden="true">{{ countryFlag(c.code) }}</span>
          {{ c.country }}
        </span>
      </div>
    </section>

    <!-- Color showcase: the artwork itself, in the studio's own color schemes -->
    <section class="bg-card/60 py-20 sm:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <ColorShowcase />
      </div>
    </section>

    <!-- What's in every design -->
    <section class="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <div class="mb-10 max-w-xl sm:mb-14">
        <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
          Made from the mountain, not from an illustration.
        </h2>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="f in FEATURES" :key="f.title" class="gap-4 p-6">
          <div
            class="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <component :is="f.icon" :size="16" />
          </div>
          <div>
            <h3
              class="mb-1.5 font-display text-lg tracking-tight text-card-foreground"
            >
              {{ f.title }}
            </h3>
            <p class="text-sm text-muted-foreground">{{ f.text }}</p>
          </div>
        </Card>
      </div>

      <dl
        class="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-border pt-10 sm:mt-20 lg:grid-cols-4"
      >
        <div v-for="s in STATS" :key="s.label" class="flex flex-col">
          <dt class="order-2 mt-1 text-xs text-muted-foreground">
            {{ s.label }}
          </dt>
          <dd class="font-display text-3xl tracking-tight sm:text-4xl">
            {{ s.value }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- FAQ: native <details>, so it works (and is indexable) without any client JS -->
    <section class="bg-card/60 py-20 sm:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
              Good to know.
            </h2>
            <p class="mt-4 text-sm text-muted-foreground sm:text-base">
              Skycomb Studio is still young. Here is what works today, and
              what doesn't yet.
            </p>
          </div>
          <div class="divide-y divide-border border-y border-border">
            <details v-for="item in FAQ" :key="item.q" class="group py-5">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-display text-base tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
              >
                {{ item.q }}
                <Plus
                  :size="16"
                  class="shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                />
              </summary>
              <p class="mt-3 max-w-prose text-sm text-muted-foreground">
                {{ item.a }}
              </p>
            </details>
          </div>
        </div>
      </div>
    </section>

    <!-- Closing call to action: same black-and-white moment as the hero, bookending the page -->
    <section
      class="relative flex items-end overflow-hidden bg-black text-white"
    >
      <div class="absolute inset-0">
        <HeroRidgeline
          :width="1200"
          :height="520"
          :relief="12"
          class="opacity-60"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black via-black/60 via-60% to-black/80"
        />
      </div>
      <div
        class="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-24 text-center sm:py-32"
      >
        <h2
          class="max-w-2xl font-display text-3xl leading-[1.1] tracking-tight sm:text-5xl"
        >
          Pick a mountain and see what it looks like as lines.
        </h2>
        <Button as-child variant="default">
          <NuxtLink to="/studio" class="gap-1.5">
            Open the studio
            <ArrowRight :size="14" />
          </NuxtLink>
        </Button>
      </div>
    </section>

    <SiteFooter />
  </main>
</template>
