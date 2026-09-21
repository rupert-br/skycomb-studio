<script setup lang="ts">
import type { VariantProps } from "class-variance-authority"
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { toggleVariants } from '@/components/ui/toggle'
import { reactiveOmit } from "@vueuse/core"
import { ToggleGroupRoot, useForwardPropsEmits } from "reka-ui"
import { provide } from "vue"
import { cn } from "@/lib/utils"

type ToggleGroupVariants = VariantProps<typeof toggleVariants>

const props = defineProps<ToggleGroupRootProps & {
  class?: HTMLAttributes["class"]
  size?: ToggleGroupVariants["size"]
}>()

const emits = defineEmits<ToggleGroupRootEmits>()

provide("toggleGroup", { size: props.size })

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <!-- Port of app/frontend/src/components/ui/toggle-group.tsx: individually spaced/gapped
       chips, not shadcn's default joined segmented control. -->
  <ToggleGroupRoot
    v-slot="slotProps"
    data-slot="toggle-group"
    :data-size="size"
    v-bind="forwarded"
    :class="cn('flex flex-wrap items-center gap-2', props.class)"
  >
    <slot v-bind="slotProps" />
  </ToggleGroupRoot>
</template>
