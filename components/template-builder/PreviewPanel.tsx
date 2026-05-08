'use client';

import type { CSSProperties } from 'react';

import type { QuotationTemplateConfig } from '@/components/template-builder/LeftPanel';

export type PreviewPanelProps = {
  config: QuotationTemplateConfig;
};

const SAMPLE = {
  customerName: 'Mr. Sample Client',
  venue: 'Grand Ballroom',
  eventType: 'Wedding Reception',
  pax: 500,
  serviceType: 'Catering',
  eventDate: '15 Jun 2026',
  lineItems: [
    {
      category: 'Main Course',
      dish_name: 'Chicken Biriyani',
      quantity: '100',
      unit: 'kg',
    },
    {
      category: 'Main Course',
      dish_name: 'Ghee Rice',
      quantity: '35',
      unit: 'kg',
    },
    {
      category: 'Welcome Drinks',
      dish_name: 'Carrot Delite',
      quantity: '',
      unit: '',
      is_compliment: false,
    },
    {
      category: 'Welcome Drinks',
      dish_name: 'Watermelon Juice',
      quantity: '',
      unit: '',
      is_compliment: true,
    },
  ],
  services: [
    { name: '27 Service staff', quantity: '' },
    { name: 'Premium plates — 1700 nos', quantity: '' },
  ],
  total: 250000,
  subtotal: 240000,
  serviceCharge: 10000,
};

function fmtINR(n: number): string {
  try {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))}`;
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function sectionTitleStyle(primary: string): CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    color: primary,
    borderLeft: `3px solid ${primary}`,
    paddingLeft: 8,
    marginBottom: 8,
  };
}

const sectionWrap: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '0.5px solid #f0f0f0',
};

const PREVIEW_IDS: Record<'premium' | 'classic' | 'minimal', string[]> = {
  premium: ['cover', 'about', 'header', 'menu', 'services', 'gallery', 'pricing', 'notes', 'terms', 'signature'],
  classic: ['cover', 'header', 'menu', 'pricing', 'notes', 'terms'],
  minimal: ['cover', 'header', 'pricing'],
};

export default function PreviewPanel({ config }: PreviewPanelProps) {
  const primary = config.primary_color || '#1a6b4a';
  const bg = config.background_color || '#ffffff';

  const tier: keyof typeof PREVIEW_IDS =
    config.template_type === 'premium' || config.template_type === 'minimal'
      ? config.template_type
      : 'classic';
  const sectionIds = PREVIEW_IDS[tier];

  const cssVars = {
    '--primary': primary,
    '--accent': config.accent_color || '#ffffff',
  } as CSSProperties;

  return (
    <div className="panel-right flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3f4f6]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] px-4 py-3">
        <span className="text-sm font-semibold text-[#0f172a]">Live preview</span>
        <span className="text-xs text-[#64748b]">Approximate A4</span>
      </header>

      <div className="panel-body overflow-y-auto bg-[#f3f4f6] p-4">
        <div
          className="mx-auto max-w-[560px] overflow-hidden rounded-lg border border-[#e5e7eb] shadow-sm"
          style={{ ...cssVars, background: bg }}
        >
          {sectionIds.map((sid) => {
            switch (sid) {
              case 'cover':
                return <PreviewCover key={sid} config={config} />;
              case 'about':
                return <PreviewAbout key={sid} config={config} />;
              case 'header':
                return <PreviewHeader key={sid} config={config} />;
              case 'menu':
                return <PreviewMenu key={sid} config={config} />;
              case 'services':
                return <PreviewServices key={sid} config={config} />;
              case 'gallery':
                return <PreviewGallery key={sid} config={config} />;
              case 'pricing':
                return <PreviewPricing key={sid} config={config} />;
              case 'notes':
                return <PreviewNotes key={sid} config={config} />;
              case 'terms':
                return <PreviewTerms key={sid} config={config} />;
              case 'signature':
                return <PreviewSignature key={sid} config={config} />;
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewCover({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const letter = (config.business_name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="px-5 py-8 text-center"
      style={{ backgroundColor: primary }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 text-xl font-bold text-white"
      >
        {letter}
      </div>
      <div className="text-base font-bold text-white">{config.business_name || 'Business name'}</div>
      {config.tagline ? (
        <div className="mt-2 text-[10px] italic text-white/70">{config.tagline}</div>
      ) : null}
      {config.phone ? (
        <div className="mt-3 text-[10px] text-white">{config.phone}</div>
      ) : null}
    </div>
  );
}

function PreviewAbout({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const body = (config.about_text || '').trim();
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>About us</div>
      <p className="text-[10px] leading-relaxed text-[#475569]">
        {body || 'Company description goes here...'}
      </p>
    </div>
  );
}

function PreviewHeader({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const rows = [
    ['Customer', SAMPLE.customerName],
    ['Venue', SAMPLE.venue],
    ['Event', SAMPLE.eventType],
    ['Guests', String(SAMPLE.pax)],
    ['Service', SAMPLE.serviceType],
    ['Date', SAMPLE.eventDate],
  ];
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Event details</div>
      <div className="space-y-2">
        {rows.map(([label, val]) => (
          <div key={label} className="grid grid-cols-[100px_1fr] gap-2">
            <div className="text-[9px] font-medium uppercase tracking-wide text-[#94a3b8]">
              {label}
            </div>
            <div className="text-[10px] text-[#0f172a]">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewMenu({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const byCat: Record<string, typeof SAMPLE.lineItems> = {};
  for (const item of SAMPLE.lineItems) {
    const c = item.category || 'General';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(item);
  }
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Menu</div>
      <div className="space-y-3">
        {Object.entries(byCat).map(([cat, items]) => (
          <div key={cat}>
            <div className="mb-1 text-[10px] font-bold" style={{ color: primary }}>
              {cat}
            </div>
            <ul className="space-y-1">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-2 text-[10px] text-[#334155]">
                  <span>
                    {it.dish_name || '—'}
                    {it.is_compliment ? (
                      <span className="ml-1 italic text-[#94a3b8]">(compliment)</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[#64748b]">
                    {[it.quantity, it.unit].filter(Boolean).join(' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewServices({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Services & equipment</div>
      <ul className="space-y-1">
        {SAMPLE.services.map((s, i) => (
          <li key={i} className="text-[10px] text-[#334155]">
            {s.name}
            {s.quantity ? ` · ${s.quantity}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewGallery({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const urls = (config.gallery_images || []).filter(Boolean).slice(0, 3);
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Gallery</div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) =>
          urls[i] ? (
            <img
              key={i}
              src={urls[i]}
              alt=""
              className="h-10 w-full rounded object-cover"
            />
          ) : (
            <div key={i} className="h-10 rounded bg-[#e2e8f0]" />
          ),
        )}
      </div>
    </div>
  );
}

function PreviewPricing({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const sub = SAMPLE.subtotal;
  const svc = SAMPLE.serviceCharge;
  const taxPct = Number(config.tax_percent) || 0;
  const advPct = Number(config.advance_percent) || 0;
  const taxAmt = Math.round((sub * taxPct) / 100);
  const preTax = sub + svc;
  const totalWithTax = preTax + taxAmt;
  const perHead =
    SAMPLE.pax > 0 ? Math.round(preTax / SAMPLE.pax) : 0;
  const advanceAmt = Math.round((totalWithTax * advPct) / 100);

  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Pricing</div>
      <div className="ml-auto w-[55%] space-y-1 text-[10px]">
        {config.pricing_style === 'simple_total' && (
          <>
            <Row label="Subtotal" value={fmtINR(sub)} />
            <Row label="Service charge" value={fmtINR(svc)} />
            <TotalRow primary={primary} value={fmtINR(SAMPLE.total)} />
          </>
        )}
        {config.pricing_style === 'tax_table' && (
          <>
            <Row label="Subtotal" value={fmtINR(sub)} />
            <Row label={`Tax (${taxPct}%)`} value={fmtINR(taxAmt)} />
            <Row label={`Advance (${advPct}%)`} value={fmtINR(advanceAmt)} />
            <TotalRow primary={primary} value={fmtINR(totalWithTax)} />
          </>
        )}
        {config.pricing_style === 'per_head' && (
          <>
            <Row label="Per head (est.)" value={fmtINR(perHead)} />
            <Row label={`× Guests (${SAMPLE.pax})`} value={fmtINR(perHead * SAMPLE.pax)} />
            <TotalRow primary={primary} value={fmtINR(preTax)} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[#475569]">
      <span>{label}</span>
      <span className="font-medium text-[#0f172a]">{value}</span>
    </div>
  );
}

function TotalRow({ primary, value }: { primary: string; value: string }) {
  return (
    <div
      className="mt-2 flex justify-between rounded px-2 py-1.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: primary }}
    >
      <span>Total</span>
      <span>{value}</span>
    </div>
  );
}

function PreviewNotes({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const notes = config.special_notes || [];
  const show = notes.length ? notes : ['—', '—', '—'];
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Special information</div>
      <ul className="list-disc space-y-1 pl-4 text-[10px] text-[#334155]">
        {show.map((n, i) => (
          <li key={i} className={notes.length ? '' : 'text-[#cbd5e1]'}>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewTerms({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  const clauses = config.terms_clauses || [];
  const show = clauses.length ? clauses : ['—', '—', '—'];
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Terms & conditions</div>
      <ol className="list-decimal space-y-1 pl-4 text-[10px] text-[#334155]">
        {show.map((c, i) => (
          <li key={i} className={clauses.length ? '' : 'text-[#cbd5e1]'}>
            {c}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PreviewSignature({ config }: { config: QuotationTemplateConfig }) {
  const primary = config.primary_color || '#1a6b4a';
  return (
    <div style={sectionWrap}>
      <div style={sectionTitleStyle(primary)}>Acceptance</div>
      <p className="mb-4 text-[10px] text-[#475569]">
        To accept this quotation, sign below and return.
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="mb-8 border-b border-[#cbd5e1]" />
          <div className="text-[9px] text-[#94a3b8]">Client signature</div>
        </div>
        <div>
          <div className="mb-8 border-b border-[#cbd5e1]" />
          <div className="text-[9px] text-[#94a3b8]">{config.business_name || 'Company'} authorized signatory</div>
        </div>
      </div>
    </div>
  );
}
