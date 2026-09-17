import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  // Google Maps' travel-mode chip: white/bordered when off, filled blue when on.
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

function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root className={cn(toggleVariants({ size, className }))} {...props} />
}

export { Toggle, toggleVariants }
