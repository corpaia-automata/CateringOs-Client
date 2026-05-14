import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safe positive integer for guest counts (comma-separated OK; avoids parseInt float quirks). */
const GUEST_COUNT_MAX = 2_147_483_647

export function parseGuestCount(raw: string | number | null | undefined, fallback = 1): number {
  if (raw === null || raw === undefined || raw === '') return fallback
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return fallback
    const n = Math.round(raw)
    return n >= 1 ? Math.min(n, GUEST_COUNT_MAX) : fallback
  }
  const n = Number(String(raw).trim().replace(/,/g, ''))
  if (!Number.isFinite(n)) return fallback
  const rounded = Math.round(n)
  return rounded >= 1 ? Math.min(rounded, GUEST_COUNT_MAX) : fallback
}
