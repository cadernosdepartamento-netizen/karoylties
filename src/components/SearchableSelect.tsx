import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchableSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onValueChange, placeholder = "Selecione...", className, disabled }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setSearchTerm('');
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  const selectedOption = useMemo(() => {
    return options.find(o => o.value === value);
  }, [options, value]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn("w-full justify-between font-normal bg-white", className)}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {value === 'all' || !value
            ? <span className="text-muted-foreground">{placeholder}</span>
            : selectedOption?.label || value
          }
        </span>
        <ChevronDown size={14} className="ml-2 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-full w-max max-w-[90vw] sm:max-w-md max-h-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md bg-white flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              className="w-full text-xs p-1.5 border rounded outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="overflow-auto p-1 flex-1 max-h-60">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Nenhuma opção</div>
            ) : (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const isSelected = value === option.value;
                  return (
                    <div
                      key={option.value}
                      onClick={() => {
                        onValueChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100",
                        isSelected && "bg-slate-50 font-medium"
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected && <Check size={14} />}
                      </span>
                      <span className="break-words whitespace-normal text-left">{option.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
