import type { MenuDish } from '@/src/types/quotation';

/** INR using Indian locale grouping. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parse API decimal strings (or numbers) for currency display. */
export function parseAmount(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Long weekday date, e.g. Saturday, 12 April 2025 */
export function formatEventDateIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCostingDisplayValue(value: unknown, formatCurrency: (n: number) => string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return formatCurrency(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return '—';
    const n = Number(trimmed.replace(/,/g, ''));
    if (Number.isFinite(n)) return formatCurrency(n);
    return trimmed;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function groupDishesByCategory(dishes: MenuDish[]): Map<string, MenuDish[]> {
  const map = new Map<string, MenuDish[]>();
  for (const dish of dishes) {
    const cat = (typeof dish.category === 'string' && dish.category.trim() ? dish.category.trim() : 'Other');
    const list = map.get(cat);
    if (list) list.push(dish);
    else map.set(cat, [dish]);
  }
  return map;
}

export function dishQuantityLabel(dish: MenuDish, showQuantities: boolean): string | null {
  if (!showQuantities) return null;
  const raw = dish.quantity as unknown;
  if (raw === null || raw === undefined || raw === '') return null;
  const qty = String(raw).trim();
  if (!qty) return null;
  const unit = typeof dish.unit === 'string' ? dish.unit.trim() : '';
  return unit ? `${qty} ${unit}` : qty;
}

export function equipmentAsStrings(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((x) => (typeof x === 'string' ? x : String(x)));
}
