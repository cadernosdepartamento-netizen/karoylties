import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortableData<T>(items: T[], config: SortConfig | null = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        // 1. Handle Null/Undefined (always put at bottom or top?)
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // 2. Date Comparison
        // Check if values are dates or valid ISO strings/formatted date strings
        const isDate = (val: any) => {
          if (val instanceof Date) return true;
          if (typeof val === 'string') {
            // Regex for common date formats in this app (YYYY-MM-DD or DD/MM/YYYY)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
            if (dateRegex.test(val)) {
                const d = new Date(val.includes('/') ? val.split('/').reverse().join('-') : val);
                return !isNaN(d.getTime());
            }
          }
          return false;
        };

        if (isDate(aValue) && isDate(bValue)) {
          const dateA = aValue instanceof Date ? aValue : new Date(String(aValue).includes('/') ? String(aValue).split('/').reverse().join('-') : String(aValue));
          const dateB = bValue instanceof Date ? bValue : new Date(String(bValue).includes('/') ? String(bValue).split('/').reverse().join('-') : String(bValue));
          
          return sortConfig.direction === 'asc' 
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        }

        // 3. Number Comparison
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // 4. String Comparison (localeCompare for pt-BR)
        const strA = String(aValue);
        const strB = String(bValue);

        return sortConfig.direction === 'asc'
          ? strA.localeCompare(strB, 'pt-BR', { sensitivity: 'base', numeric: true })
          : strB.localeCompare(strA, 'pt-BR', { sensitivity: 'base', numeric: true });
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
}
