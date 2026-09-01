import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface VolumeSliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  muted?: boolean;
  trackClassName?: string;
}

const VolumeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  VolumeSliderProps
>(({ className, muted, trackClassName, onPointerDown, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("vol-slider relative", className)}
    data-muted={muted ? "" : undefined}
    onPointerDown={(e) => {
      (e.currentTarget as HTMLElement).setAttribute("data-dragging", "");
      onPointerDown?.(e);
    }}
    onPointerUp={(e) => {
      (e.currentTarget as HTMLElement).removeAttribute("data-dragging");
    }}
    onPointerCancel={(e) => {
      (e.currentTarget as HTMLElement).removeAttribute("data-dragging");
    }}
    {...props}
  >
    <SliderPrimitive.Track className={cn("vol-slider-track", trackClassName)}>
      <SliderPrimitive.Range className="vol-slider-range" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="vol-slider-thumb" aria-label="Volume" />
  </SliderPrimitive.Root>
));
VolumeSlider.displayName = "VolumeSlider";

export { VolumeSlider };
