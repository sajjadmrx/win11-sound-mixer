import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function MuteButton({ muted, onToggle, size = "md", className }: MuteButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "icon-sm" : "icon"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={muted ? "Unmute" : "Mute"}
          className={cn(
            "shrink-0 text-muted-foreground hover:text-foreground",
            muted &&
              "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
            className,
          )}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{muted ? "Unmute" : "Mute"}</TooltipContent>
    </Tooltip>
  );
}
