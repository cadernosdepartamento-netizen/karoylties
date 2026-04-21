import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortOptions<T>(
  options: T[],
  type: 'text' | 'number' = 'text'
): T[] {
  const specialKeywords = ['todos', 'todas'];
  
  return [...options].sort((a: any, b: any) => {
    const getLabel = (val: any) => {
      if (val && typeof val === 'object' && 'label' in val) return String(val.label);
      return String(val);
    };

    const getValue = (val: any) => {
      if (val && typeof val === 'object' && 'value' in val) return val.value;
      return val;
    };

    const labelA = getLabel(a).toLowerCase();
    const labelB = getLabel(b).toLowerCase();

    const isSpecialA = specialKeywords.some(kw => labelA === kw || labelA.startsWith(kw + ' '));
    const isSpecialB = specialKeywords.some(kw => labelB === kw || labelB.startsWith(kw + ' '));

    if (isSpecialA && !isSpecialB) return -1;
    if (!isSpecialA && isSpecialB) return 1;

    if (type === 'number') {
      const valA = parseFloat(String(getValue(a))) || 0;
      const valB = parseFloat(String(getValue(b))) || 0;
      return valA - valB;
    }

    return getLabel(a).localeCompare(getLabel(b), 'pt-BR', { sensitivity: 'base' });
  });
}
