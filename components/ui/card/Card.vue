<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <!-- Material panel: elevation shadow carries the separation from the map, not a border.
       Port of app/frontend/src/components/ui/card.tsx. -->
  <div
    data-slot="card"
    :class="cn('flex flex-col gap-3 rounded-xl bg-card p-3 text-card-foreground shadow-elevation-2', props.class)"
  >
    <slot />
  </div>
</template>
