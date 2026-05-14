'use client';

import { useState } from 'react';

export interface QuotationTemplateConfig {
  id: string;
  tenant: string;
  template_type: 'premium' | 'classic' | 'minimal';
  business_name: string;
  tagline: string;
  logo_url: string;
  cover_image_url: string;
  phone: string;
  offices: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  font_family: string;
  footer_text: string;
  pricing_style: 'simple_total' | 'tax_table' | 'per_head';
  tax_percent: number | string;
  advance_percent: number | string;
  about_text: string;
  gallery_images: string[];
  special_notes: string[];
  terms_clauses: string[];
}

type LeftPanelProps = {
  config: QuotationTemplateConfig;
  onChange: (key: string, value: unknown) => void;
};

type TabId = 'branding' | 'pricing' | 'terms';

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: 'branding', label: 'Branding' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'terms', label: 'Terms & Notes' },
];

function str(config: QuotationTemplateConfig, key: keyof QuotationTemplateConfig): string {
  const v = config[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function LeftPanel({ config, onChange }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('branding');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <nav className="flex shrink-0 gap-1 border-b border-[#e5e7eb] px-2 pt-2">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white text-[#0f172a] shadow-[inset_0_-2px_0_0_#1C3355]'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="panel-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {activeTab === 'branding' && <BrandingTab config={config} onChange={onChange} />}
        {activeTab === 'pricing' && <PricingTab config={config} onChange={onChange} />}
        {activeTab === 'terms' && <TermsTab config={config} onChange={onChange} />}
      </div>
    </div>
  );
}

function BrandingTab({
  config,
  onChange,
}: {
  config: QuotationTemplateConfig;
  onChange: LeftPanelProps['onChange'];
}) {
  const pc = str(config, 'primary_color') || '#1a6b4a';
  const ac = str(config, 'accent_color') || '#ffffff';
  const bc = str(config, 'background_color') || '#ffffff';

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Template type <span className="normal-case text-[#94a3b8]">(PDF layout tier)</span>
        </span>
        <select
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.template_type}
          onChange={(e) =>
            onChange('template_type', e.target.value as QuotationTemplateConfig['template_type'])
          }
        >
          <option value="premium">Premium</option>
          <option value="classic">Classic</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Business name</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.business_name}
          onChange={(e) => onChange('business_name', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Tagline</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.tagline}
          onChange={(e) => onChange('tagline', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Phone</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.phone}
          onChange={(e) => onChange('phone', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Offices</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.offices}
          onChange={(e) => onChange('offices', e.target.value)}
        />
      </label>

      <ColorPair label="Primary color" value={pc} onChange={(v) => onChange('primary_color', v)} />
      <ColorPair label="Accent color" value={ac} onChange={(v) => onChange('accent_color', v)} />
      <ColorPair label="Background color" value={bc} onChange={(v) => onChange('background_color', v)} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Logo URL</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.logo_url}
          onChange={(e) => onChange('logo_url', e.target.value)}
        />
      </label>
      {config.logo_url ? (
        <img
          src={config.logo_url}
          alt=""
          className="max-h-[40px] w-auto object-contain object-left"
        />
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Cover image URL</span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.cover_image_url}
          onChange={(e) => onChange('cover_image_url', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Font family <span className="normal-case text-[#94a3b8]">(e.g. Georgia, serif)</span>
        </span>
        <input
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.font_family}
          placeholder="Georgia (serif)"
          onChange={(e) => onChange('font_family', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Footer text</span>
        <textarea
          rows={3}
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.footer_text}
          onChange={(e) => onChange('footer_text', e.target.value)}
        />
      </label>
    </div>
  );
}

function ColorPair({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-10 w-14 shrink-0 cursor-pointer rounded border border-[#e5e7eb]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="min-w-[120px] flex-1 rounded-md border border-[#e5e7eb] px-3 py-2 font-mono text-sm text-[#0f172a]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

function PricingTab({
  config,
  onChange,
}: {
  config: QuotationTemplateConfig;
  onChange: LeftPanelProps['onChange'];
}) {
  const taxStr = String(config.tax_percent ?? '');
  const advStr = String(config.advance_percent ?? '');
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Pricing style</span>
        <select
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.pricing_style}
          onChange={(e) =>
            onChange('pricing_style', e.target.value as QuotationTemplateConfig['pricing_style'])
          }
        >
          <option value="simple_total">Simple total</option>
          <option value="tax_table">Tax table</option>
          <option value="per_head">Per head</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Tax / GST %</span>
        <input
          type="number"
          step="0.1"
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={taxStr}
          onChange={(e) => onChange('tax_percent', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Advance %</span>
        <input
          type="number"
          step="0.1"
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={advStr}
          onChange={(e) => onChange('advance_percent', e.target.value)}
        />
      </label>
    </div>
  );
}

function TermsTab({
  config,
  onChange,
}: {
  config: QuotationTemplateConfig;
  onChange: LeftPanelProps['onChange'];
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">
          About us text <span className="normal-case text-[#94a3b8]">(Premium preview)</span>
        </span>
        <textarea
          rows={4}
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={config.about_text}
          onChange={(e) => onChange('about_text', e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Special notes</span>
        <textarea
          rows={5}
          placeholder="One note per line"
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={(config.special_notes || []).join('\n')}
          onChange={(e) =>
            onChange(
              'special_notes',
              e.target.value.split('\n').filter(Boolean),
            )
          }
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Terms & conditions</span>
        <textarea
          rows={6}
          placeholder="One clause per line"
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={(config.terms_clauses || []).join('\n')}
          onChange={(e) =>
            onChange(
              'terms_clauses',
              e.target.value.split('\n').filter(Boolean),
            )
          }
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Gallery images <span className="normal-case text-[#94a3b8]">(Premium — one URL per line)</span>
        </span>
        <textarea
          rows={4}
          placeholder="One image URL per line"
          className="rounded-md border border-[#e5e7eb] px-3 py-2 text-sm text-[#0f172a]"
          value={(config.gallery_images || []).join('\n')}
          onChange={(e) =>
            onChange(
              'gallery_images',
              e.target.value.split('\n').filter(Boolean),
            )
          }
        />
      </label>
    </div>
  );
}
