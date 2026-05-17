"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchComboboxOption = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
};

type SearchComboboxProps = {
  value: string;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onSelect: (option: SearchComboboxOption) => void;
  options: SearchComboboxOption[];
  placeholder: string;
  emptyText: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SearchCombobox({
  value,
  inputValue,
  onInputValueChange,
  onSelect,
  options,
  placeholder,
  emptyText,
  loading = false,
  disabled = false,
  className,
}: SearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={(event) => {
            onInputValueChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-popover p-1 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                Loading results...
              </div>
            ) : options.length > 0 ? (
              options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onSelect(option);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                      active && "bg-muted",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {option.label}
                      </div>
                      {option.description ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {option.meta ? (
                        <span className="text-[11px] text-muted-foreground">
                          {option.meta}
                        </span>
                      ) : null}
                      {active ? (
                        <Check className="size-4 text-primary" />
                      ) : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!open && selectedOption && !inputValue ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {selectedOption.label}
        </button>
      ) : null}
    </div>
  );
}
