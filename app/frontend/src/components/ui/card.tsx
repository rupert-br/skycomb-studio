import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    // Material panel: elevation shadow carries the separation from the map, not a border.
    <div className={cn("flex flex-col gap-3 rounded-xl bg-card p-3 text-card-foreground shadow-elevation-2", className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3", className)} {...props} />
}

export { Card, CardContent }
