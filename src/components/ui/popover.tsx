import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

function PopoverHeader({
  title = "Select Output Device",
  subtitle,
  className,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-3.5 pb-2 pt-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      <PopoverClose className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </PopoverClose>
    </div>
  );
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-pop outline-none",
        "data-[state=open]:animate-pop-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose, PopoverHeader };

