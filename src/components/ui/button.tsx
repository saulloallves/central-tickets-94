import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-primary-foreground hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] shadow-neumorphic",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-glow shadow-neumorphic",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-neumorphic hover:shadow-card",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-neumorphic hover:shadow-card",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-xl",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-gradient-primary text-primary-foreground hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] shadow-elegant",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-neumorphic hover:shadow-glow",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-neumorphic hover:shadow-glow",
        info: "bg-info text-info-foreground hover:bg-info/90 shadow-neumorphic hover:shadow-glow",
        critical: "bg-critical text-critical-foreground hover:bg-critical/90 shadow-neumorphic hover:shadow-glow",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-xl px-4",
        lg: "h-14 rounded-2xl px-8",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
