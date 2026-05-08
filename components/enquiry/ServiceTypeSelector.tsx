'use client'

import { cn } from '@/lib/utils'

const SERVICE_TYPES = ['Buffet', 'Box Counter', 'Table Service']

interface ServiceTypeSelectorProps {
  selected: string
  onChange: (value: string) => void
}

export function ServiceTypeSelector({ selected, onChange }: ServiceTypeSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Service Type
      </p>

      <div className="flex flex-wrap gap-2">
        {SERVICE_TYPES.map((type) => {
          const active = selected === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(active ? '' : type)}
              className={cn(
                'rounded-full px-4 py-2 text-[13px] font-semibold transition-all',
                active
                  ? 'text-white border border-transparent'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700',
              )}
              style={active ? { background: 'black' } : undefined}
            >
              {type}
            </button>
          )
        })}
      </div>
    </div>
  )
}
