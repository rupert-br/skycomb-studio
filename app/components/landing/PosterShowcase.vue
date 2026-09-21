<script setup lang="ts">
// A static stand-in for the studio's poster: the same baked Großglockner terrain as the hero,
// re-inked with the studio's own color schemes (lib/posterColors.ts) so the swatches here are
// exactly the ones the studio offers.
import { HERO_RIDGELINE } from '~/data/heroRidgeline'
import { degrees } from '~/lib/format'
import { POSTER_COLOR_SCHEMES, DEFAULT_POSTER_COLOR_SCHEME_ID, posterColorScheme } from '~/lib/posterColors'

const schemeId = ref(DEFAULT_POSTER_COLOR_SCHEME_ID)
const scheme = computed(() => posterColorScheme(schemeId.value))

const [west, south, east, north] = HERO_RIDGELINE.bbox
const subtitle = `${degrees((south + north) / 2, 'N', 'S')} · ${degrees((west + east) / 2, 'E', 'W')} · looking ${HERO_RIDGELINE.direction}`
</script>

<template>
  <div class="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-20">
    <div class="max-w-md">
      <h2 class="font-display text-3xl tracking-tight sm:text-4xl">
        One mountain, five moods.
      </h2>
      <p class="mt-4 text-sm text-muted-foreground sm:text-base">
        The lines are always real terrain. What they're drawn on is up to you:
        pick a palette and the poster, the download and every product preview
        follow it.
      </p>

      <div
        role="radiogroup"
        aria-label="Poster color scheme"
        class="mt-8 flex flex-wrap gap-3"
      >
        <button
          v-for="s in POSTER_COLOR_SCHEMES"
          :key="s.id"
          type="button"
          role="radio"
          :aria-checked="schemeId === s.id"
          :aria-label="s.name"
          class="group flex flex-col items-center gap-1.5 outline-none"
          @click="schemeId = s.id"
        >
          <span
            class="flex size-11 items-center justify-center rounded-full border border-border shadow-elevation-1 ring-offset-2 ring-offset-card transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring"
            :class="schemeId === s.id ? 'ring-2 ring-brand' : 'group-hover:shadow-elevation-2'"
            :style="{ backgroundColor: s.background }"
          >
            <span class="h-px w-5 rounded-full" :style="{ backgroundColor: s.line }" />
          </span>
          <span
            class="text-xs"
            :class="schemeId === s.id ? 'text-foreground' : 'text-muted-foreground'"
            >{{ s.name }}</span
          >
        </button>
      </div>
    </div>

    <!-- The poster: A-series ratio, like the studio's own .poster card -->
    <div
      class="mx-auto flex aspect-[0.70711] w-full max-w-[21rem] flex-col p-[7%] shadow-elevation-2 transition-colors duration-300 sm:max-w-sm"
      :style="{ backgroundColor: scheme.background }"
    >
      <div class="min-h-0 flex-1">
        <HeroRidgeline
          :width="800"
          :height="880"
          :relief="13"
          :stroke="scheme.line"
          class="transition-colors duration-300"
        />
      </div>
      <div class="pt-[6%] text-center">
        <p
          class="font-display text-xl tracking-wide transition-colors duration-300 sm:text-2xl"
          :style="{ color: scheme.line }"
        >
          Großglockner
        </p>
        <p
          class="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors duration-300"
          :style="{ color: scheme.subtitleText }"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>
  </div>
</template>
