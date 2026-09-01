import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function deviceKindIcon(kind: string): string {
  switch (kind) {
    case "headphones":
      return "headphones";
    case "bluetooth":
      return "bluetooth";
    case "hdmi":
      return "monitor";
    case "usb":
      return "speaker-usb";
    default:
      return "speaker";
  }
}

export function appHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function timeOfDay(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
