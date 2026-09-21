<script setup lang="ts">
// About page — SSR'd like the landing page. Every claim here mirrors what the app actually does
// (see CONCEPT.md); the peak/country counts are read from the same data the studio's picker uses.
import { ArrowRight, Coffee, Database, Frame, MapPin, Shirt, ShoppingBag, SlidersHorizontal } from '@lucide/vue'
import { COUNTRIES, peaksGeoJSON } from '~/data/mountains'
import { PRODUCTS } from '~/data/products'
import type { ProductId } from '~/data/products'

useHead({ title: 'About: Skycomb Studio' })
useSeoMeta({
  title: 'About Skycomb Studio',
  description:
    'Skycomb Studio turns real elevation data into ridgeline artwork: frame any mountain area in the world on a map and put the result on prints, apparel, mugs and more.',
})

const peakCount = peaksGeoJSON().features.length
const countryCount = COUNTRIES.length

const STATS = [
  { value: 'Worldwide', label: 'terrain coverage: frame any range on Earth' },
  { value: `${peakCount}+`, label: `ready-made peaks in ${countryCount} countries` },
  { value: '~12 m', label: 'best terrain resolution' },
  { value: '240', label: 'lines at most per design' },
]

const PRODUCT_ICONS: Record<ProductId, typeof Frame> = {
  poster: Frame,
  tshirt: Shirt,
  hoodie: Shirt,
  totebag: ShoppingBag,
  mug: Coffee,
}

const PILLARS = [
  {
    icon: Database,
    title: 'Real terrain, not an illustration',
    text: 'Every line is sampled from public elevation tiles for the area you framed. Sharp summits stay sharp, and a broad valley stays broad.',
  },
  {
    icon: MapPin,
    title: 'Named summits',
    text: 'Peak names come from OpenStreetMap and are placed on the highest point of the terrain, then snapped to the nearest drawn ridge so labels sit on the peak.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Yours to style',
    text: 'Choose the viewing direction, how many lines to draw, how dramatic the relief is, which labels to show and what the title says. Changes apply instantly.',
  },
]

const SOURCES = [
  {
    name: 'AWS Terrain Tiles',
    text: 'Elevation. An open compilation of SRTM, Copernicus, national datasets and others, used with attribution.',
  },
  {
    name: 'OpenStreetMap',
    text: 'Summit names and heights, © OpenStreetMap contributors, available under the ODbL.',
  },
  {
    name: 'Mapbox',
    text: 'The interactive globe you frame your design on. It is only used for choosing the area; the artwork itself never touches it.',
  },
]

const NEXT = [
  'Shareable links that reopen a design exactly as you left it',
  'More print sizes and orientations, with print-ready PDF export',
  'Upload a GPX track to trace a hike or race across the ridgelines',
  'Real checkout and printing for prints and merch',
  'Files for pen plotters and laser cutters, for drawing or engraving the lines',
  'Custom editions for huts, tourism regions and races',
  'Accounts, so you can save your designs',
]
</script>

<template>
  <main class="bg-background text-foreground">
    <SiteHeader />

    <!-- Same black-and-white palette as the poster and the landing hero -->
    <section
      class="relative -mt-[68px] flex min-h-[52vh] items-end overflow-hidden bg-black pt-[68px] text-white"
    >
      <div class="absolute inset-0">
        <HeroRidgeline :width="1200" :height="520" :relief="12" class="opacity-70" />
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/70 via-50% to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent to-30%" />
      </div>
      <div class="relative mx-auto w-full max-w-6xl px-6 pb-14 sm:pb-20">
        <p class="mb-3 font-mono text-xs uppercase tracking-widest text-white/60">About</p>
        <h1 class="max-w-3xl font-display text-4xl leading-[1.08] tracking-tight sm:text-6xl">
          Mountains, drawn one skyline at a time.
        </h1>
      </div>
    </section>

    <!-- The idea -->
    <section class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div class="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
          A map is flat. A ridge is a line.
        </h2>
        <div class="space-y-4 text-base text-muted-foreground sm:text-lg">
          <p>
            Skycomb Studio turns any mountain area into ridgeline artwork: a
            drawing made of stacked lines. Each line is the skyline you would see looking across one
            thin slice of the terrain. Stack the slices from the far edge to the
            near one, let each nearer ridge hide what is behind it, and the
            whole massif appears out of nothing but white lines on black.
          </p>
          <p>
            You choose the place, anywhere in the world. Frame it on the map,
            pick one of the peaks that are already loaded, or search for a
            summit by name. The studio does
            the rest and hands you the artwork. What it becomes is up to you.
          </p>
        </div>
      </div>

      <dl class="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-border pt-10 sm:mt-20 lg:grid-cols-4">
        <div v-for="s in STATS" :key="s.label" class="flex flex-col">
          <dt class="order-2 mt-1 text-xs text-muted-foreground">{{ s.label }}</dt>
          <dd class="font-display text-3xl tracking-tight sm:text-4xl">{{ s.value }}</dd>
        </div>
      </dl>
    </section>

    <!-- One design, many things -->
    <section class="bg-card/60 py-16 sm:py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mb-10 max-w-xl sm:mb-14">
          <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
            One mountain, many things to make from it.
          </h2>
          <p class="mt-4 text-sm text-muted-foreground sm:text-base">
            The artwork is not tied to a paper size. The same render can go
            onto whatever you want to wear, carry, drink from or hang.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card v-for="p in PRODUCTS" :key="p.id" class="items-center gap-3 p-5 text-center">
            <div class="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <component :is="PRODUCT_ICONS[p.id]" :size="18" />
            </div>
            <div>
              <h3 class="font-display text-base tracking-tight text-card-foreground">{{ p.name }}</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ p.tagline }}</p>
            </div>
          </Card>
        </div>
        <p class="mt-6 text-xs text-muted-foreground">
          Previews only for now. Checkout and printing are not connected yet.
        </p>
      </div>
    </section>

    <!-- What makes it tick -->
    <section class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <h2 class="mb-10 max-w-xl font-display text-3xl tracking-tight sm:mb-14 sm:text-4xl">
          What goes into every design.
        </h2>
        <div class="grid gap-4 md:grid-cols-3">
          <Card v-for="p in PILLARS" :key="p.title" class="gap-4 p-6">
            <div class="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <component :is="p.icon" :size="16" />
            </div>
            <div>
              <h3 class="mb-1.5 font-display text-lg tracking-tight text-card-foreground">
                {{ p.title }}
              </h3>
              <p class="text-sm text-muted-foreground">{{ p.text }}</p>
            </div>
          </Card>
        </div>
    </section>

    <!-- Credits -->
    <section class="bg-card/60 py-16 sm:py-24">
      <div class="mx-auto max-w-6xl px-6">
        <div class="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 class="font-display text-3xl tracking-tight sm:text-4xl">Built on open data.</h2>
            <p class="mt-4 text-sm text-muted-foreground sm:text-base">
              The mountains belong to everyone, and so does the data behind
              this artwork. Here is who to thank.
            </p>
          </div>
          <ul class="divide-y divide-border border-y border-border">
            <li v-for="s in SOURCES" :key="s.name" class="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
              <span class="font-display text-base tracking-tight">{{ s.name }}</span>
              <span class="text-sm text-muted-foreground">{{ s.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Roadmap: plans, not promises — none of these are built yet -->
    <section class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div class="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 class="font-display text-3xl tracking-tight sm:text-4xl">Where it is heading.</h2>
            <p class="mt-4 text-sm text-muted-foreground sm:text-base">
              Skycomb Studio is still young. Today you can frame, render, tune
              and download a design, and preview it on a poster, tee, hoodie,
              tote or mug. Ordering is not connected yet. Next on the list:
            </p>
          </div>
          <ol class="space-y-3">
            <li
              v-for="(item, i) in NEXT"
              :key="item"
              class="flex items-start gap-4 rounded-xl bg-card p-4 shadow-elevation-1"
            >
              <span class="font-mono text-xs text-muted-foreground tabular-nums">0{{ i + 1 }}</span>
              <span class="text-sm text-card-foreground">{{ item }}</span>
            </li>
          </ol>
        </div>
    </section>

    <!-- Call to action -->
    <section class="mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
      <h2 class="mx-auto max-w-xl font-display text-3xl tracking-tight sm:text-4xl">
        Pick a mountain and see what it looks like as lines.
      </h2>
      <div class="mt-8 flex justify-center">
        <Button as-child>
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
