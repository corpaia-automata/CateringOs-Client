'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangeKey =
  | ''
  | 'today'
  | 'next3d'
  | 'next7d'
  | 'next30d'
  | 'next3m'
  | 'next6m'
  | 'next1y'
  | 'custom';

export interface DateRangeValue {
  key: DateRangeKey;
  from: string; // YYYY-MM-DD or ''
  to: string;   // YYYY-MM-DD or ''
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Optional placeholder label shown when key is '' */
  placeholder?: string;
}

// ─── Options ──────────────────────────────────────────────────────────────────

const OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: '',       label: 'All Dates'     },
  { key: 'today',  label: 'Today'         },
  { key: 'next3d', label: 'Next 3 Days'   },
  { key: 'next7d', label: 'Next 7 Days'   },
  { key: 'next30d',label: 'Next 30 Days'  },
  { key: 'next3m', label: 'Next 3 Months' },
  { key: 'next6m', label: 'Next 6 Months' },
  { key: 'next1y', label: 'Next 1 Year'   },
  { key: 'custom', label: 'Custom Range'  },
];

// ─── Helper: compute from/to for preset keys ─────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveDateRange(key: DateRangeKey, customFrom = '', customTo = ''): { from: string; to: string } {
  const today = new Date();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const addMonths = (n: number) => { const d = new Date(today); d.setMonth(d.getMonth() + n); return d; };
  switch (key) {
    case 'today':   return { from: fmt(today),          to: fmt(today) };
    case 'next3d':  return { from: fmt(today),          to: fmt(addDays(3)) };
    case 'next7d':  return { from: fmt(today),          to: fmt(addDays(7)) };
    case 'next30d': return { from: fmt(today),          to: fmt(addDays(30)) };
    case 'next3m':  return { from: fmt(today),          to: fmt(addMonths(3)) };
    case 'next6m':  return { from: fmt(today),          to: fmt(addMonths(6)) };
    case 'next1y':  return { from: fmt(today),          to: fmt(addMonths(12)) };
    case 'custom':  return { from: customFrom,          to: customTo };
    default:        return { from: '',                  to: '' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateRangeFilter({ value, onChange, placeholder = 'Date Range' }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(value.key === 'custom' ? value.from : '');
  const [localTo,   setLocalTo]   = useState(value.key === 'custom' ? value.to   : '');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync local custom inputs when value resets from outside (e.g. clear filters)
  useEffect(() => {
    if (value.key !== 'custom') {
      setLocalFrom('');
      setLocalTo('');
    }
  }, [value.key]);

  function selectPreset(key: DateRangeKey) {
    if (key === 'custom') {
      // Don't close — let user pick dates
      onChange({ key: 'custom', from: localFrom, to: localTo });
      return;
    }
    const { from, to } = resolveDateRange(key);
    onChange({ key, from, to });
    setOpen(false);
  }

  function applyCustom() {
    onChange({ key: 'custom', from: localFrom, to: localTo });
    setOpen(false);
  }

  function clearCustom() {
    setLocalFrom('');
    setLocalTo('');
    onChange({ key: 'custom', from: '', to: '' });
  }

  const activeLabel = OPTIONS.find(o => o.key === value.key)?.label ?? placeholder;
  const isActive    = value.key !== '';

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
        style={{
          border: `1.5px solid ${isActive ? '#1C3355' : '#E2E8F0'}`,
          backgroundColor: isActive ? '#EFF6FF' : '#F8FAFC',
          color: isActive ? '#1C3355' : '#64748B',
          fontWeight: isActive ? 600 : 400,
        }}
      >
        <Calendar size={14} style={{ color: isActive ? '#1C3355' : '#94A3B8' }} />
        <span>{activeLabel}</span>
        {isActive ? (
          <X
            size={12}
            className="ml-0.5 hover:opacity-70"
            onClick={e => { e.stopPropagation(); onChange({ key: '', from: '', to: '' }); setOpen(false); }}
          />
        ) : (
          <ChevronDown size={12} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30 rounded-xl py-1 min-w-[200px]"
          style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {OPTIONS.map(({ key, label }) => {
            const selected = value.key === key;
            const isCustom = key === 'custom';
            return (
              <div key={key}>
                <button
                  onClick={() => selectPreset(key)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                  style={{ color: selected ? '#1C3355' : '#0F172A', fontWeight: selected ? 600 : 400 }}
                >
                  <span>{label}</span>
                  {selected && !isCustom && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1C3355' }} />
                  )}
                  {isCustom && <Calendar size={11} style={{ color: '#94A3B8' }} />}
                </button>

                {/* Custom date inputs — shown inline when custom is selected */}
                {isCustom && value.key === 'custom' && (
                  <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium" style={{ color: '#64748B' }}>From</label>
                      <input
                        type="date"
                        value={localFrom}
                        max={localTo || undefined}
                        onChange={e => setLocalFrom(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                        style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#1C3355')}
                        onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium" style={{ color: '#64748B' }}>To</label>
                      <input
                        type="date"
                        value={localTo}
                        min={localFrom || undefined}
                        onChange={e => setLocalTo(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                        style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#1C3355')}
                        onBlur={e  => (e.currentTarget.style.borderColor = '#E2E8F0')}
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={applyCustom}
                        disabled={!localFrom || !localTo}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: '#1C3355' }}
                      >
                        Apply
                      </button>
                      <button
                        onClick={clearCustom}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ border: '1px solid #E2E8F0', color: '#64748B' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
