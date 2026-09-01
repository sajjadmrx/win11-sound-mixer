import { cn, appHue } from "@/lib/utils";

interface AppIconProps {
  appId: string;
  name: string;
  icon?: string | null;
  className?: string;
  rounded?: string;
}

export function AppIcon({
  appId,
  name,
  icon,
  className,
  rounded = "rounded-lg",
}: AppIconProps) {
  if (icon) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden bg-white/[0.04]",
          rounded,
          className,
        )}
      >
        <img src={icon} alt="" className="h-full w-full object-contain" draggable={false} />
      </div>
    );
  }
  const hue = appHue(appId);
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center font-semibold text-white/90 select-none",
        rounded,
        className,
      )}
      style={{
        background: `hsl(${hue} 45% 22%)`,
        color: `hsl(${hue} 80% 78%)`,
      }}
    >
      <span className="text-[55%] leading-none">{letter}</span>
    </div>
  );
}
