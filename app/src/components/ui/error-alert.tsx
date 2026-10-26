import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

function ErrorAlert({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      role="alert"
      className={cn(
        "border border-ink bg-secondary px-3 py-2 text-sm text-foreground",
        className
      )}
    >
      {children}
    </p>
  )
}

export { ErrorAlert }
