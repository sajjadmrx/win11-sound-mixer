import { useMemo } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 14;

interface AudioBarsProps {
  peak: number;
  active: boolean;
  className?: string;
}

export function AudioBars({ peak, active, className }: AudioBarsProps) {
  const isPlaying = active && peak > 0.005;

  const heights = useMemo(() => {
    if (!isPlaying) {
      return Array.from({ length: BAR_COUNT }, () => 2.5);
    }
    const level = Math.min(1, peak * 2.5);
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const wave =
        0.35
        + 0.65
          * Math.abs(Math.sin((i / (BAR_COUNT - 1)) * Math.PI * 1.8 + 0.35))
          * (i % 2 === 0 ? 1.0 : 0.78);
      const h = Math.max(3, wave * (4 + level * 16));
      return Math.round(h * 10) / 10;
    });
  }, [peak, isPlaying]);

  return (
    <div
      className={cn(
        "flex h-5 items-center gap-[2.5px] px-1 transition-all duration-300",
        isPlaying ? "eq-active opacity-100" : "eq-idle opacity-30",
        className,
      )}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="eq-bar"
          style={{
            height: `${h}px`,
            transitionDelay: isPlaying ? `${i * 12}ms` : "0ms",
            animationDelay: isPlaying ? `${i * 60}ms` : "0ms",
          }}
        />
      ))}
    </div>
  );
}
