import type React from "react";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search applications...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 rounded-lg pl-8 pr-8 text-[13px]"
      />
      {value && (
        <button
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface MenuOption {
  value: string;
  label: string;
  hint?: string;
}

interface MenuSelectProps {
  value: string;
  options: MenuOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  align?: "start" | "end" | "center";
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function MenuSelect({
  value,
  options,
  onSelect,
  placeholder = "Select…",
  align = "end",
  className,
  label,
  disabled,
}: MenuSelectProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 justify-start gap-2 border-border/80 bg-elevated/50 px-2.5 text-[12.5px] font-medium text-foreground/90 hover:bg-elevated",
            className,
          )}
        >
          {label && (
            <span className="text-[11px] font-normal text-muted-foreground">
              {label}
            </span>
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-52 p-1.5">
        {options.map((o) => (
          <PopoverClose asChild key={o.value}>
            <button
              onClick={() => onSelect(o.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                o.value === value
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && (
                  <span className="block text-[11px] text-muted-foreground/80">
                    {o.hint}
                  </span>
                )}
              </span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}