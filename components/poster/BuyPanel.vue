<script setup lang="ts">
// UI-only "buy" flow: a product picker with a mocked-up preview of the current poster on
// each item, a session cart (persisted via useCart/@vueuse's useStorage), and a stub
// checkout button. No payment or fulfilment provider is wired up — see CONCEPT.md's roadmap,
// which lists real checkout/print-on-demand as a later phase.
import { Check, ShoppingBag, X } from '@lucide/vue'
import { CURRENCY, PRODUCTS, productById } from '~/data/products'
import type { ProductId } from '~/data/products'

const props = defineProps<{
  open: boolean
  posterImage: string | null
  title: string
  subtitle: string
}>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { cart, add, remove, count, total } = useCart()

const selectedId = ref<ProductId>('poster')
const product = computed(() => productById(selectedId.value))
const selectedSize = ref(product.value.sizes[0]!)
const selectedColorIdx = ref(0)
const selectedColor = computed(() => product.value.colors[selectedColorIdx.value] ?? null)

watch(product, (p) => {
  selectedSize.value = p.sizes[0]!
  selectedColorIdx.value = 0
})

// The rasterized poster (chart + title block) always comes out close to this width:height
// ratio (chart forced to the A4 aspect, plus the fixed padding/caption band around it) — see
// getPosterImage in RidgelineChart.vue. Used to size the print area on each mockup so the art
// doesn't come out stretched.
const POSTER_IMG_ASPECT = 0.66

const printRect = computed(() => {
  if (selectedId.value === 'poster') return { x: 48, y: 38, width: 144, height: 144 / POSTER_IMG_ASPECT }
  if (selectedId.value === 'mug') return { x: 95, y: 118, width: 60, height: 60 / POSTER_IMG_ASPECT }
  if (selectedId.value === 'totebag') return { x: 82, y: 158, width: 76, height: 76 / POSTER_IMG_ASPECT }
  return { x: 88, y: 104, width: 64, height: 64 / POSTER_IMG_ASPECT } // tshirt / hoodie
})

const justAdded = ref(false)
let addedTimer: ReturnType<typeof setTimeout> | undefined

function addToCart() {
  if (!props.posterImage) return
  add({
    productId: product.value.id,
    productName: product.value.name,
    size: selectedSize.value,
    color: selectedColor.value?.name,
    price: product.value.priceFrom,
    title: props.title || 'Ridgelines',
    image: props.posterImage,
  })
  justAdded.value = true
  clearTimeout(addedTimer)
  addedTimer = setTimeout(() => (justAdded.value = false), 2200)
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[900] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      @click.self="close"
    >
      <div
        class="flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-card text-card-foreground shadow-elevation-2 sm:max-w-3xl sm:rounded-2xl"
      >
        <div class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-5 py-4">
          <h2 class="font-display text-lg tracking-tight">Bring it home</h2>
          <Button aria-label="Close" size="sm" variant="ghost" class="rounded-full px-0" @click="close">
            <X :size="16" />
          </Button>
        </div>

        <div class="grid gap-6 p-5 sm:grid-cols-[minmax(0,220px)_1fr]">
          <!-- Mockup preview -->
          <div class="flex flex-col items-center gap-2">
            <div class="flex w-full items-center justify-center rounded-xl bg-muted p-4">
              <svg viewBox="0 0 240 300" class="h-auto w-full max-w-[220px]">
                <defs>
                  <clipPath id="buy-print-clip">
                    <rect v-bind="printRect" rx="3" />
                  </clipPath>
                </defs>

                <!-- Poster: frame + mat + full artwork (title included) -->
                <template v-if="selectedId === 'poster'">
                  <rect x="30" y="20" width="180" height="260" rx="2" fill="#241d16" />
                  <rect x="40" y="30" width="160" height="240" fill="#f4efe2" />
                  <image
                    v-if="posterImage"
                    :href="posterImage"
                    v-bind="printRect"
                    preserveAspectRatio="xMidYMid meet"
                  />
                </template>

                <!-- Mug: body + handle, wraparound print -->
                <template v-else-if="selectedId === 'mug'">
                  <rect x="70" y="110" width="110" height="110" rx="10" :fill="selectedColor?.hex ?? '#f5f5f0'" stroke="#00000040" />
                  <path d="M180,130 C212,130 212,190 180,190" fill="none" stroke="#00000040" stroke-width="13" />
                  <path d="M180,130 C212,130 212,190 180,190" fill="none" :stroke="selectedColor?.hex ?? '#f5f5f0'" stroke-width="9" />
                  <image
                    v-if="posterImage"
                    :href="posterImage"
                    v-bind="printRect"
                    preserveAspectRatio="xMidYMid meet"
                    clip-path="url(#buy-print-clip)"
                  />
                </template>

                <!-- Tote bag: body + two handles, front-panel print -->
                <template v-else-if="selectedId === 'totebag'">
                  <path d="M85,112 C85,72 105,72 105,112" fill="none" stroke="#00000040" stroke-width="9" />
                  <path d="M85,112 C85,72 105,72 105,112" fill="none" :stroke="selectedColor?.hex ?? '#e4ddca'" stroke-width="6" />
                  <path d="M135,112 C135,72 155,72 155,112" fill="none" stroke="#00000040" stroke-width="9" />
                  <path d="M135,112 C135,72 155,72 155,112" fill="none" :stroke="selectedColor?.hex ?? '#e4ddca'" stroke-width="6" />
                  <rect x="55" y="108" width="130" height="152" rx="6" :fill="selectedColor?.hex ?? '#e4ddca'" stroke="#00000040" />
                  <image
                    v-if="posterImage"
                    :href="posterImage"
                    v-bind="printRect"
                    preserveAspectRatio="xMidYMid slice"
                    clip-path="url(#buy-print-clip)"
                  />
                </template>

                <!-- T-shirt / hoodie: shared silhouette, hoodie adds a hood -->
                <template v-else>
                  <path
                    v-if="selectedId === 'hoodie'"
                    d="M75,63 Q120,18 165,63 L150,76 Q120,44 90,76 Z"
                    :fill="selectedColor?.hex ?? '#111214'"
                    stroke="#00000040"
                  />
                  <path
                    d="M90,60 L60,60 L15,95 L55,130 L62,140 L62,270 L178,270 L178,140 L185,130 L225,95 L180,60 L150,60 L120,90 Z"
                    :fill="selectedColor?.hex ?? '#111214'"
                    stroke="#00000040"
                  />
                  <image
                    v-if="posterImage"
                    :href="posterImage"
                    v-bind="printRect"
                    preserveAspectRatio="xMidYMid slice"
                    clip-path="url(#buy-print-clip)"
                  />
                </template>
              </svg>
            </div>
            <p v-if="!posterImage" class="text-center text-xs text-muted-foreground">Render a poster first to preview it on products.</p>
          </div>

          <!-- Product + options -->
          <div class="flex flex-col gap-4">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in PRODUCTS"
                :key="p.id"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                :class="
                  p.id === selectedId
                    ? 'bg-brand text-brand-foreground shadow-elevation-1'
                    : 'border border-border bg-card text-foreground hover:bg-muted'
                "
                @click="selectedId = p.id"
              >
                {{ p.name }}
              </button>
            </div>

            <div>
              <p class="text-sm text-foreground">{{ product.tagline }}</p>
              <p class="mt-0.5 text-sm font-medium text-foreground">From {{ CURRENCY }}{{ product.priceFrom }}</p>
            </div>

            <div v-if="product.sizes.length > 1 || product.sizes[0] !== 'One size'">
              <Label class="mb-1.5 block text-xs text-muted-foreground">Size</Label>
              <ToggleGroup
                type="single"
                :model-value="selectedSize"
                @update:model-value="(v) => v && (selectedSize = v as string)"
              >
                <ToggleGroupItem v-for="s in product.sizes" :key="s" :value="s" size="sm">{{ s }}</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div v-if="product.colors.length">
              <Label class="mb-1.5 block text-xs text-muted-foreground">Color</Label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(c, i) in product.colors"
                  :key="c.name"
                  type="button"
                  :aria-label="c.name"
                  :aria-pressed="i === selectedColorIdx"
                  class="size-7 rounded-full ring-offset-2 transition-shadow"
                  :class="i === selectedColorIdx ? 'ring-2 ring-ring' : 'ring-1 ring-border'"
                  :style="{ background: c.hex }"
                  @click="selectedColorIdx = i"
                />
              </div>
            </div>

            <Button variant="default" class="mt-1 w-fit" :disabled="!posterImage" @click="addToCart">
              <Check v-if="justAdded" :size="14" />
              {{ justAdded ? 'Added' : `Add to cart: ${CURRENCY}${product.priceFrom}` }}
            </Button>

            <div v-if="cart.length" class="mt-2 border-t border-border pt-3">
              <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShoppingBag :size="14" /> Cart ({{ count }})
              </p>
              <ul class="flex flex-col gap-1.5">
                <li v-for="item in cart" :key="item.id" class="flex items-center gap-2 text-xs">
                  <img :src="item.image" alt="" class="size-8 shrink-0 rounded bg-black object-cover" />
                  <span class="min-w-0 flex-1 truncate text-foreground">
                    {{ item.productName }}<span v-if="item.color"> · {{ item.color }}</span> · {{ item.size }}
                  </span>
                  <span class="shrink-0 font-mono tabular-nums text-muted-foreground">{{ CURRENCY }}{{ item.price }}</span>
                  <button type="button" aria-label="Remove" class="shrink-0 text-muted-foreground hover:text-destructive" @click="remove(item.id)">
                    <X :size="12" />
                  </button>
                </li>
              </ul>
              <div class="mt-3 flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-foreground">Total {{ CURRENCY }}{{ total }}</span>
                <Button variant="outline" disabled title="Checkout isn't wired up yet. This is a preview of the shopping flow.">
                  Checkout: coming soon
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
