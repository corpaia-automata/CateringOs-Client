'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset =
  | ''
  | 'today'
  | 'next3d'
  | 'nextWeek'
  | 'nextMonth'
  | 'next3m'
  | 'next6m'
  | 'nextYear';

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: '',          label: 'All Dates'     },
  { key: 'today',     label: 'Today'         },
  { key: 'next3d',    label: 'Next 3 Days'   },
  { key: 'nextWeek',  label: 'Next Week'     },
  { key: 'nextMonth', label: 'Next Month'    },
  { key: 'next3m',    label: 'Next 3 Months' },
  { key: 'next6m',    label: 'Next 6 Months' },
  { key: 'nextYear',  label: 'Next Year'     },
];

// ─── Date resolution ─────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveDatePreset(key: DatePreset): { startDate: string; endDate: string } {
  const today = new Date();
  const addDays   = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const addMonths = (n: number) => { const d = new Date(today); d.setMonth(d.getMonth() + n); return d; };
  switch (key) {
    case 'today':     return { startDate: fmt(today), endDate: fmt(today) };
    case 'next3d':    return { startDate: fmt(today), endDate: fmt(addDays(3)) };
    case 'nextWeek':  return { startDate: fmt(today), endDate: fmt(addDays(7)) };
    case 'nextMonth': return { startDate: fmt(today), endDate: fmt(addMonths(1)) };
    case 'next3m':    return { startDate: fmt(today), endDate: fmt(addMonths(3)) };
    case 'next6m':    return { startDate: fmt(today), endDate: fmt(addMonths(6)) };
    case 'nextYear':  return { startDate: fmt(today), endDate: fmt(addMonths(12)) };
    default:          return { startDate: '', endDate: '' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DateRangeDropdownProps {
  /** Currently selected preset key — empty string means "no filter". */
  value: DatePreset;
  /** Called with the new key and the resolved start/end dates. */
  onChange: (key: DatePreset, startDate: string, endDate: string) => void;
  placeholder?: string;
}

export function DateRangeDropdown({
  value,
  onChange,
  placeholder = 'Date Range',
}: DateRangeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(key: DatePreset) {
    const { startDate, endDate } = resolveDatePreset(key);
    onChange(key, startDate, endDate);
    setOpen(false);
  }

  const activeLabel = PRESETS.find(p => p.key === value)?.label ?? placeholder;
  const isActive    = value !== '';

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
        style={{
          border:          `1.5px solid ${isActive ? '#1C3355' : '#E2E8F0'}`,
          backgroundColor: isActive ? '#EFF6FF' : '#F8FAFC',
          color:           isActive ? '#1C3355' : '#64748B',
          fontWeight:      isActive ? 600 : 400,
        }}
      >
        <Calendar size={14} style={{ color: isActive ? '#1C3355' : '#94A3B8' }} />
        <span>{isActive ? activeLabel : placeholder}</span>
        {isActive ? (
          <X
            size={12}
            className="ml-0.5 hover:opacity-70"
            onClick={e => { e.stopPropagation(); select(''); }}
          />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 rounded-xl py-1 min-w-[180px]"
          style={{
            backgroundColor: '#fff',
            border:          '1px solid #E2E8F0',
            boxShadow:       '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {PRESETS.map(({ key, label }) => {
            const selected = value === key;
            return (
              <button
                key={key}
                onClick={() => select(key)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                style={{ color: selected ? '#1C3355' : '#0F172A', fontWeight: selected ? 600 : 400 }}
              >
                <span>{label}</span>
                {selected && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1C3355' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
