import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Toggle } from "./Toggle.vue"

// Google Maps' travel-mode chip: white/bordered when off, filled blue when on. Port of
// app/frontend/src/components/ui/toggle.tsx (no "variant" axis in the original — just size).
export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card text-xs font-medium tracking-wide capitalize transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary data-[state=on]:hover:bg-primary",
  {
    variants: {
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5",
      },
    },
    defaultVariants: { size: "default" },
  },
)

export type ToggleVariants = VariantProps<typeof toggleVariants>
