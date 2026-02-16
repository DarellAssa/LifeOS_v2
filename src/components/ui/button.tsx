import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:brightness-[1.06] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[var(--shadow-xs)] active:brightness-[0.97]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-xs)] hover:bg-destructive/90 hover:-translate-y-[0.5px] active:translate-y-0",
        outline:
          "border border-border bg-card text-foreground shadow-[var(--shadow-xs)] hover:bg-accent/50 hover:border-border hover:shadow-[var(--shadow-sm)] hover:-translate-y-[0.5px] active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/40 hover:bg-secondary/80 hover:-translate-y-[0.5px] active:translate-y-0",
        ghost:
          "hover:bg-accent/60 hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-3.5",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
