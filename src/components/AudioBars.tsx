import { useMemo } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 14;

interface AudioBarsProps {
  peak: number;
  active: boolean;
  className?: string;
}

export function AudioBars({ peak, active, className }: AudioBarsProps) {
  const heights = useMemo(() => {
    const level = Math.min(1, peak * 2.2);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const wave =
        0.35 +
        0.65 * Math.abs(Math.sin((i / BAR_COUNT) * Math.PI * 1.7 + 0.4)) *
          (i % 2 === 0 ? 1 : 0.72);
      const h = active ? 3 + wave * (4 + level * 16) : 2.5 + wave * 1.8;
      return Math.round(h * 10) / 10;
    });
  }, [peak, active]);

  return (
    <div
      className={cn(
        "flex h-5 items-center gap-[3px]",
        !active && "eq-idle opacity-70",
        className,
      )}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div key={i} className="eq-bar" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}
