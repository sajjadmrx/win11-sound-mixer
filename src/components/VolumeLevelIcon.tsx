import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VolumeLevelIcon({
  volume,
  muted,
  className,
}: {
  volume: number;
  muted: boolean;
  className?: string;
}) {
  if (muted || volume === 0) {
    return <VolumeX className={cn("h-4 w-4", className)} />;
  }
  if (volume < 50) {
    return <Volume1 className={cn("h-4 w-4", className)} />;
  }
  return <Volume2 className={cn("h-4 w-4", className)} />;
}
