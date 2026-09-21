<script setup lang="ts">
// Port of the Card markup in App.tsx (direction/lines/relief/labels controls, the chart
// itself, and the download menu) — split out into its own component so the page doesn't
// carry 500+ lines of JSX-equivalent template. Owns purely presentational state: chart
// sizing, the download-format menu, and the RidgelineChart's imperative handle.
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
} from '@lucide/vue'
import type { ExportFormat } from '~/components/poster/RidgelineChart.vue'
import { MAX_LAT_SPAN, MAX_LON_SPAN } from '~/lib/constants'
import { POSTER_COLOR_SCHEMES, posterColorScheme } from '~/lib/posterColors'
import type { Direction, RidgelinesResponse, Summit } from '~/types/ridgeline'

const DIRECTIONS: Direction[] = ['north', 'east', 'south', 'west']
const ARROWS = {
  north: ArrowUp,
  east: ArrowRight,
  south: ArrowDown,
  west: ArrowLeft,
}

const props = defineProps<{
  collapsed: boolean
  result: RidgelinesResponse | null
  loading: boolean
  error: string
  areaTooLarge: boolean
  canRender: boolean
  visibleSummits: Summit[]
  summitsNote: string
  subtitle: string
}>()

const emit = defineEmits<{ 'update:collapsed': [value: boolean]; render: [] }>()

const direction = defineModel<Direction>('direction', { required: true })
const lines = defineModel<number>('lines', { required: true })
const relief = defineModel<number>('relief', { required: true })
const labels = defineModel<boolean>('labels', { required: true })
const title = defineModel<string>('title', { required: true })
const colorSchemeId = defineModel<string>('colorSchemeId', { required: true })
const showText = defineModel<boolean>('showText', { required: true })
const transparentBackground = defineModel<boolean>('transparentBackground', {
  required: true,
})

const colorScheme = computed(() => posterColorScheme(colorSchemeId.value))

const posterEl = useTemplateRef<HTMLDivElement>('posterEl')
const chartSize = useChartSize(posterEl)

const chartEl = useTemplateRef('chartEl')
const exportFormat = ref<ExportFormat>('jpg')
const formatMenuOpen = ref(false)
const FORMATS: ExportFormat[] = ['jpg', 'png', 'svg']

function download(format: ExportFormat) {
  chartEl.value?.download(title.value, props.subtitle, format)
}
</script>

<template>
  <button
    v-if="collapsed"
    type="button"
    aria-label="Show ridgeline panel"
    class="ridgeline-panel-morph z-[600] flex w-fit items-center justify-center gap-1.5 self-start rounded-xl bg-card text-xs font-medium tracking-wide text-foreground shadow-elevation-2 hover:bg-muted max-sm:mx-4 max-sm:mb-4 max-sm:h-10 max-sm:px-4 sm:absolute sm:top-1/2 sm:right-4 sm:h-fit sm:-translate-y-1/2 sm:flex-col sm:gap-2 sm:px-2 sm:py-3"
    @click="emit('update:collapsed', false)"
  >
    <ChevronLeft :size="14" class="max-sm:hidden" />
    <span class="max-sm:hidden [writing-mode:vertical-rl] rotate-180"
      >Ridgeline</span
    >
    <span class="sm:hidden">Show ridgeline</span>
  </button>

  <Card
    v-else
    class="ridgeline-panel-morph z-[600] max-sm:mx-4 max-sm:mb-4 sm:absolute sm:top-28 sm:right-4 sm:bottom-4 sm:w-fit sm:min-w-[260px] sm:max-w-[min(92vw,720px)] sm:overflow-y-auto"
  >
    <CardContent class="sm:h-full sm:min-h-0">
      <div class="flex justify-end">
        <Button
          type="button"
          aria-label="Minimize ridgeline panel"
          class="flex shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="emit('update:collapsed', true)"
        >
          Minimize
        </Button>
      </div>

      <div
        ref="posterEl"
        class="poster"
        :class="{ 'poster--transparent': transparentBackground }"
        :style="
          transparentBackground ? {} : { background: colorScheme.background }
        "
      >
        <RidgelineChart
          v-if="result"
          ref="chartEl"
          :data="result"
          :summits="visibleSummits"
          :relief="relief"
          :labels="labels"
          :width="chartSize.width"
          :plot-height="chartSize.height"
          :color-scheme="colorScheme"
          :show-text="showText"
          :transparent-background="transparentBackground"
        />
        <p v-else-if="!loading" class="m-0 text-xs text-muted-foreground">
          Move the map, then press “Render this area”.
        </p>
        <div v-if="loading" class="poster-loading text-white">
          Sampling terrain…
        </div>
      </div>

      <div
        v-if="result"
        class="poster-caption text-center"
        :class="{ 'opacity-50': !showText }"
      >
        <input v-model="title" placeholder="Title" aria-label="Title" />
        <p
          class="mt-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground"
        >
          {{ subtitle }}
        </p>
        <p v-if="!showText" class="mt-1 text-[10px] text-muted-foreground">
          Hidden in the exported image
        </p>
      </div>

      <div
        class="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"
      >
        <span>Looking</span>
        <ToggleGroup
          type="single"
          :model-value="direction"
          @update:model-value="(v) => v && (direction = v as Direction)"
        >
          <ToggleGroupItem
            v-for="d in DIRECTIONS"
            :key="d"
            :value="d"
            size="sm"
            :aria-label="`Looking ${d}`"
          >
            <component :is="ARROWS[d]" :size="16" /> {{ d }}
          </ToggleGroupItem>
        </ToggleGroup>

        <!-- The label column is `max-content` (see the grid below), so a value that jumps
             digit count (e.g. 9 → 10) would otherwise widen the whole panel while dragging —
             a fixed-width, right-aligned slot for the number keeps the panel's width stable. -->
        <Label for="lines"
          >Lines
          <span class="inline-block w-8 text-right tabular-nums">{{
            lines
          }}</span></Label
        >
        <Slider
          id="lines"
          :default-value="[lines]"
          :min="40"
          :max="200"
          :step="10"
          @value-commit="(v) => v?.[0] !== undefined && (lines = v[0])"
        />

        <Label for="relief"
          >Relief
          <span class="inline-block w-8 text-right tabular-nums">{{
            relief
          }}</span></Label
        >
        <Slider
          id="relief"
          :model-value="[relief]"
          :min="1"
          :max="16"
          :step="0.5"
          @update:model-value="(v) => v?.[0] !== undefined && (relief = v[0])"
        />

        <span>Labels</span>
        <div class="flex flex-wrap items-center gap-2">
          <Switch id="labels" v-model="labels" />
          <Label for="labels" class="cursor-pointer">Summit names</Label>
          <span v-if="summitsNote" class="text-amber-600"
            >&middot; {{ summitsNote }}</span
          >
        </div>

        <span>Colors</span>
        <ToggleGroup
          type="single"
          :model-value="colorSchemeId"
          @update:model-value="(v) => v && (colorSchemeId = v as string)"
        >
          <ToggleGroupItem
            v-for="scheme in POSTER_COLOR_SCHEMES"
            :key="scheme.id"
            :value="scheme.id"
            size="sm"
            :aria-label="scheme.name"
            :title="scheme.name"
          >
            <span
              class="inline-block size-4 shrink-0 rounded-full ring-1 ring-black/10"
              :style="{
                background: scheme.background,
                boxShadow: `inset 0 0 0 3px ${scheme.line}`,
              }"
            />
          </ToggleGroupItem>
        </ToggleGroup>

        <span>Background</span>
        <div class="flex flex-wrap items-center gap-2">
          <Switch id="transparent-bg" v-model="transparentBackground" />
          <Label for="transparent-bg" class="cursor-pointer">Transparent</Label>
          <span v-if="transparentBackground" class="text-muted-foreground"
            >&middot; JPG keeps a solid
            {{ colorScheme.name.toLowerCase() }} background</span
          >
        </div>

        <span>Text</span>
        <div class="flex flex-wrap items-center gap-2">
          <Switch id="show-text" v-model="showText" />
          <Label for="show-text" class="cursor-pointer"
            >Title &amp; subtitle</Label
          >
        </div>
      </div>

      <p v-if="areaTooLarge" class="m-0 text-xs text-amber-600">
        Zoom in: the frame covers more than {{ MAX_LON_SPAN }}&deg; &times;
        {{ MAX_LAT_SPAN }}&deg;.
      </p>
      <p v-if="error" class="m-0 text-sm text-destructive">{{ error }}</p>

      <div class="flex items-center justify-between gap-2">
        <Button
          variant="default"
          :disabled="!canRender || loading"
          @click="emit('render')"
        >
          {{ loading ? 'Rendering…' : 'Render this area' }}
        </Button>
        <div class="inline-flex">
          <Button
            :disabled="!result"
            class="rounded-r-none"
            @click="download(exportFormat)"
          >
            Download {{ exportFormat.toUpperCase() }}
          </Button>

          <Popover v-model:open="formatMenuOpen">
            <PopoverTrigger as-child>
              <Button
                :disabled="!result"
                aria-label="Choose download format"
                class="w-8 rounded-l-none border-l border-border px-0"
              >
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  :class="[
                    'shrink-0 transition-transform',
                    formatMenuOpen ? 'rotate-180' : '',
                  ]"
                  aria-hidden="true"
                >
                  <path
                    d="M1 1l4 4 4-4"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              :side-offset="8"
              class="z-700 w-32 overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-elevation-2"
            >
              <div role="menu" aria-label="Download format">
                <button
                  v-for="format in FORMATS"
                  :key="format"
                  role="menuitem"
                  class="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 px-2.5 text-left text-sm text-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent"
                  @click="
                    () => {
                      exportFormat = format
                      formatMenuOpen = false
                      download(format)
                    }
                  "
                >
                  {{ format.toUpperCase() }}
                  <svg
                    v-if="format === exportFormat"
                    width="12"
                    height="10"
                    viewBox="0 0 12 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
