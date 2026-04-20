import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MultiSelectDropdownProps {
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectDropdown({ options, selectedValues, onChange, placeholder = "Selecione...", className }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(o => o.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleToggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const selectedLabels = useMemo(() => {
    return selectedValues
      .map(v => options.find(o => o.value === v)?.label || v)
      .filter(Boolean);
  }, [selectedValues, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between font-normal bg-white h-8 text-xs", className)}
          >
            <span className="truncate">
              {selectedValues.length === 0 
                ? <span className="text-muted-foreground">{placeholder}</span>
                : selectedValues.length === 1 
                  ? selectedLabels[0]
                  : `${selectedValues.length} selecionados`
              }
            </span>
            <ChevronDown size={14} className="ml-2 shrink-0 opacity-50" />
          </Button>
        }
      />

      <PopoverContent 
        className="p-0 w-64 sm:w-80 max-h-96 flex flex-col overflow-hidden bg-white border-slate-200 shadow-xl z-[9999]" 
        align="start"
      >
        <div className="p-2 border-b border-slate-100 bg-slate-50/50">
          <input
            type="text"
            className="w-full text-xs p-1.5 border rounded outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="overflow-auto p-1 flex-1 max-h-72">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">Nenhuma opção</div>
          ) : (
            <div className="space-y-0.5">
              {!searchTerm && (
                <div 
                  onClick={handleToggleAll}
                  className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 font-semibold border-b border-slate-100 mb-1"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-top justify-center top-2.5">
                    {selectedValues.length === options.length && options.length > 0 && <Check size={14} className="text-blue-600" />}
                  </span>
                  <span className="break-words whitespace-normal text-left">Selecionar Todos</span>
                </div>
              )}
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-[13px] outline-none hover:bg-slate-100 transition-colors",
                      isSelected && "bg-blue-50/50"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {isSelected && <Check size={14} className="text-blue-600" />}
                    </span>
                    <span className="break-words whitespace-normal text-left truncate">{option.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
