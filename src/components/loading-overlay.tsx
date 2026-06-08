import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

type LoadingOverlayProps = {
  open: boolean
  title: string
  description?: string
  variant?: "default" | "destructive"
  label?: string
}

export function LoadingOverlay({
  open,
  title,
  description,
  variant = "default",
  label,
}: LoadingOverlayProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label ?? title}
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-10 py-8 shadow-lg">
        <Loader2Icon
          className={cn(
            "size-12 animate-spin",
            variant === "destructive" ? "text-destructive" : "text-primary"
          )}
        />
        <div className="text-center">
          <p className="text-lg font-semibold">{title}</p>
          {description ? (
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
