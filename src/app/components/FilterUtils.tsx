import React, { useEffect, useRef } from 'react';

export type SortDirection = 'ASC' | 'DESC';

export type DateFilterTreeNode = {
  id: string;
  label: string;
  values: string[];
  children?: DateFilterTreeNode[];
};

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 accent-blue-600 rounded-sm outline-none focus:ring-2 focus:ring-blue-500/20 flex-shrink-0"
    />
  );
}

export function parseSortDate(dateStr: unknown): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return Date.UTC(Number(y), Number(m) - 1, Number(d));
  }

  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return Date.UTC(Number(y), Number(m) - 1, Number(d));
  }

  return null;
}

export function parseDateFilterOption(option: string) {
  // Parsear formato dd/mm/aaaa (formato principal del sistema)
  const dmy = option.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return {
      year: Number(dmy[3]),
      month: Number(dmy[2]) - 1,
      day: Number(dmy[1]),
    };
  }
  // Fallback: intentar parsear con parseSortDate
  const time = parseSortDate(option);
  if (time === null) {
    return null;
  }
  const date = new Date(time);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

export function buildDateFilterTree(options: string[]): DateFilterTreeNode[] {
  const grouped = new Map<number, Map<number, Map<number, string[]>>>();
  const emptyValues: string[] = [];

  options.forEach((option) => {
    const parsed = parseDateFilterOption(option);

    if (!parsed) {
      emptyValues.push(option);
      return;
    }

    if (!grouped.has(parsed.year)) {
      grouped.set(parsed.year, new Map());
    }

    const months = grouped.get(parsed.year)!;
    if (!months.has(parsed.month)) {
      months.set(parsed.month, new Map());
    }

    const days = months.get(parsed.month)!;
    days.set(parsed.day, [...(days.get(parsed.day) || []), option]);
  });

  const yearNodes = [...grouped.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, months]) => {
      const monthNodes = [...months.entries()]
        .sort(([left], [right]) => left - right)
        .map(([month, days]) => {
          const dayNodes = [...days.entries()]
            .sort(([left], [right]) => left - right)
            .map(([day, values]) => ({
              id: `${year}-${month + 1}-${day}`,
              label: String(day).padStart(2, '0'),
              values,
            }));

          return {
            id: `${year}-${month + 1}`,
            label: MONTH_NAMES[month],
            values: dayNodes.flatMap((node) => node.values),
            children: dayNodes,
          };
        });

      return {
        id: String(year),
        label: String(year),
        values: monthNodes.flatMap((node) => node.values),
        children: monthNodes,
      };
    });

  if (emptyValues.length > 0) {
    yearNodes.push({
      id: 'empty',
      label: '(Vacías)',
      values: emptyValues,
      children: [],
    });
  }

  return yearNodes;
}

export function getFilterMenuSortLabel(type: 'date' | 'estatus' | 'number' | 'boolean' | 'text' | string, direction: SortDirection) {
  if (type === 'date') {
    return direction === 'ASC'
      ? 'Ordenar de mas antiguos a mas recientes'
      : 'Ordenar de mas recientes a mas antiguos';
  }

  if (type === 'estatus') {
    return direction === 'ASC'
      ? 'Ordenar verde, amarillo, rojo claro y rojo'
      : 'Ordenar rojo, rojo claro, amarillo y verde';
  }

  if (type === 'number') {
    return direction === 'ASC'
      ? 'Ordenar de menor a mayor'
      : 'Ordenar de mayor a menor';
  }

  if (type === 'boolean') {
    return direction === 'ASC' ? 'Ordenar No a Si' : 'Ordenar Si a No';
  }

  return direction === 'ASC' ? 'Ordenar A a Z' : 'Ordenar Z a A';
}
