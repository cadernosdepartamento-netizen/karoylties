import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  className?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({ 
  label, 
  sortKey, 
  currentSort, 
  onSort, 
  className 
}) => {
  const isActive = currentSort?.key === sortKey;
  
  return (
    <TableHead 
      className={cn(
        "cursor-pointer select-none hover:bg-slate-100/50 transition-colors group",
        isActive && "bg-slate-50 text-blue-700",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-normal text-[11px] leading-tight whitespace-normal uppercase tracking-wider">{label}</span>
        <div className={cn(
          "transition-all duration-200 shrink-0",
          isActive ? "opacity-100 scale-100" : "opacity-20 group-hover:opacity-50"
        )}>
          {isActive ? (
            currentSort.direction === 'asc' ? (
              <ArrowUp size={10} className="stroke-[2px]" />
            ) : (
              <ArrowDown size={10} className="stroke-[2px]" />
            )
          ) : (
            <ArrowUpDown size={10} />
          )}
        </div>
      </div>
    </TableHead>
  );
};
