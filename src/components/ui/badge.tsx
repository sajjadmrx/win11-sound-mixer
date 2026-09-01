import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        {
          default: "bg-secondary text-secondary-foreground",
          accent: "bg-primary/15 text-primary",
          outline: "border border-border text-muted-foreground",
          success: "bg-emerald-500/15 text-emerald-400",
          warning: "bg-amber-500/15 text-amber-400",
        }[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
