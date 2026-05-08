export type SectionRecord = Record<string, unknown>;

export interface BrandingConfig extends SectionRecord {
  logo_url?: string;
  brand_color?: string;
  cover_image_url?: string;
  company_bio?: string;
  footer_text?: string;
}

export interface TemplateConfig extends SectionRecord {
  branding?: BrandingConfig;
  show_quantities?: boolean;
}

export interface SectionProps {
  data: SectionRecord;
  branding?: BrandingConfig;
  config: TemplateConfig;
}

export function asRecord(value: unknown): SectionRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as SectionRecord
    : {};
}

export function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    const record = asRecord(current);
    return record[key];
  }, source);
}

export function firstString(source: unknown, paths: string[], fallback = '-'): string {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

export function firstNumber(source: unknown, paths: string[], fallback = 0): number {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

export function firstArray(source: unknown, paths: string[]): unknown[] {
  for (const path of paths) {
    const value = getPath(source, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMoney(value: unknown): string {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : 0;

  if (!Number.isFinite(amount)) return 'Rs. 0';
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

