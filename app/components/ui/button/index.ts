import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

// Google Maps' chip/button shape: fully rounded, no visible border by default — separation
// comes from fill or shadow, not an outline. Port of app/frontend/src/components/ui/button.tsx
// (the prototype's own hand-tuned button, not shadcn's stock one).
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs font-medium tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        // The "Directions"-style filled pill — reserved for the primary action.
        default: "bg-brand text-brand-foreground font-semibold shadow-elevation-1 hover:shadow-elevation-2 hover:brightness-105",
        // A filter-chip: white, thin border, subtle gray fill on hover — no shadow at rest.
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "bg-transparent text-foreground hover:bg-muted",
      },
      size: {
        default: "h-9 px-4 py-1.5",
        sm: "h-8 px-3",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
