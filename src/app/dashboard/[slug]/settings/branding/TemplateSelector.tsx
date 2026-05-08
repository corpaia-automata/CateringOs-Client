'use client';

type TemplateType = 'classic' | 'premium' | 'minimal';

interface TemplateSelectorProps {
  value: TemplateType;
  accentColor: string;
  onChange: (value: TemplateType) => void;
}

const TEMPLATE_OPTIONS: Array<{
  id: TemplateType;
  name: string;
  description: string;
  badge: string;
}> = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Formal layout with elegant typography for timeless catering proposals.',
    badge: 'CL',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'High-contrast luxury style designed for premium event presentations.',
    badge: 'PR',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean modern structure focused on readability and concise pricing.',
    badge: 'MN',
  },
];

/**
 * Three-card template selector for quotation style type.
 */
export function TemplateSelector({ value, accentColor, onChange }: TemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Template Type</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {TEMPLATE_OPTIONS.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className="rounded-lg border bg-white p-4 text-left transition"
              style={{
                borderColor: selected ? accentColor : '#e2e8f0',
                boxShadow: selected ? `0 0 0 1px ${accentColor}` : 'none',
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: selected ? accentColor : '#64748b' }}
                >
                  {option.badge}
                </span>
                <span className="text-sm font-semibold text-slate-900">{option.name}</span>
              </div>
              <p className="text-xs leading-5 text-slate-600">{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
