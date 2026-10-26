/**
 * Button — Logtenia design system.
 *
 * Variants (see DESIGN.md "Components > Buttons"):
 *   - `accent` (default): Voltage Lime fill, Ink text, Ink border. The primary
 *     action on a screen (Entrenar, Siguiente, Guardar, ...). Hover drops the
 *     fill and keeps a Lime border (Lime text in dark, Ink text in light).
 *     Lime is scarce (Beacon Rule): one per view.
 *   - `ink`: Ink fill, Lime text. Active/selected state and nav toggle. In dark
 *     the ink fill inverts to paper and the text turns Ink.
 *   - `outline`: transparent, Ink border/text. Hover fills Ink / Lime text.
 *   - `ghost`: no border, Muted text. Tertiary actions (Cancelar, Reiniciar).
 *   - `secondary`: Muted Surface fill. Low-emphasis filled button.
 *   - `destructive`: Alert. Destructive actions only.
 *   - `link`: underlined primary text.
 *
 * Sizes: `xs` (h-6), `sm` (h-8), `default` (h-9), `lg` (h-11, 44px touch
 * target for in-gym flows), `icon` / `icon-sm` / `icon-lg`.
 *
 * Rules: zero radius, no shadows, `transition-colors` only, 44px touch targets
 * on in-gym screens. Never introduce a second color family.
 */
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent border-ink hover:bg-transparent hover:text-ink hover:border-accent dark:hover:text-accent",
        accent: "bg-accent text-on-accent border-ink hover:bg-transparent hover:text-ink hover:border-accent dark:hover:text-accent",
        ink: "bg-ink text-on-ink border-ink hover:bg-accent hover:text-on-accent",
        outline:
          "bg-transparent text-ink border-ink hover:bg-ink hover:text-on-ink",
        secondary:
          "bg-secondary text-foreground border-border hover:bg-muted hover:text-foreground",
        ghost:
          "bg-transparent text-muted-foreground border-transparent hover:bg-muted-surface hover:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/40 hover:bg-destructive/20",
        link: "bg-transparent text-primary border-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-xs",
        sm: "h-8 gap-1 px-2.5 text-sm",
        lg: "h-11 gap-2 px-6",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "accent",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }