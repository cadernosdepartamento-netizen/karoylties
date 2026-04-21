import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortableData<T>(items: T[], config: SortConfig | null = null, secondarySortConfig?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const compare = (key: string, dir: SortDirection) => {
          const aVal = a[key as keyof T];
          const bVal = b[key as keyof T];

          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          const isDate = (val: any) => {
            if (val instanceof Date) return true;
            if (typeof val === 'string') {
              const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
              if (dateRegex.test(val)) {
                  const d = new Date(val.includes('/') ? val.split('/').reverse().join('-') : val);
                  return !isNaN(d.getTime());
              }
            }
            return false;
          };

          if (isDate(aVal) && isDate(bVal)) {
            const dateA = aVal instanceof Date ? aVal : new Date(String(aVal).includes('/') ? String(aVal).split('/').reverse().join('-') : String(aVal));
            const dateB = bVal instanceof Date ? bVal : new Date(String(bVal).includes('/') ? String(bVal).split('/').reverse().join('-') : String(bVal));
            
            return dir === 'asc' 
              ? dateA.getTime() - dateB.getTime()
              : dateB.getTime() - dateA.getTime();
          }

          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
          }

          const strA = String(aVal);
          const strB = String(bVal);

          return dir === 'asc'
            ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base', numeric: true })
            : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base', numeric: true });
        };

        const primaryResult = compare(sortConfig.key, sortConfig.direction);
        if (primaryResult !== 0) return primaryResult;

        // Custom hardcoded fallback for year -> month sorting, else generic fallback
        if (sortConfig.key === 'year' && a && b && typeof a === 'object' && typeof b === 'object' && 'month' in a && 'month' in b) {
          return compare('month', 'asc'); // Always ascending for secondary month sort, or match dir? We'll match dir.
        }
        
        if (sortConfig.key === 'year' && sortConfig.key !== 'month' && secondarySortConfig) {
             return compare(secondarySortConfig.key, secondarySortConfig.direction);
        }

        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig, secondarySortConfig]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
