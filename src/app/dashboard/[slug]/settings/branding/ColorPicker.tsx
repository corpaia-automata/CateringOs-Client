'use client';

import { useMemo } from 'react';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function normalizeHex(value: string): string {
  if (!value) return '#000000';
  if (HEX_PATTERN.test(value)) return value;
  if (/^[0-9A-Fa-f]{6}$/.test(value)) return `#${value}`;
  return '#000000';
}

/**
 * Native color picker with editable hex text input.
 */
export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const safeValue = useMemo(() => normalizeHex(value), [value]);

  const handleTextChange = (next: string) => {
    if (next === '' || next === '#') {
      onChange(next);
      return;
    }
    if (HEX_PATTERN.test(next)) {
      onChange(next);
    } else if (/^[0-9A-Fa-f]{6}$/.test(next)) {
      onChange(`#${next}`);
    } else {
      onChange(next);
    }
  };

  const hasError =
    value !== '' &&
    value !== '#' &&
    !HEX_PATTERN.test(value) &&
    !/^[0-9A-Fa-f]{6}$/.test(value);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_PATTERN.test(safeValue) ? safeValue : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => handleTextChange(event.target.value)}
          placeholder="#000000"
          className={`h-10 w-full rounded border px-3 text-sm ${
            hasError ? 'border-red-300 text-red-700' : 'border-slate-300 text-slate-800'
          }`}
        />
      </div>
      {hasError ? <p className="text-xs text-red-600">Enter a valid hex color like #1A2B3C</p> : null}
    </div>
  );
}
