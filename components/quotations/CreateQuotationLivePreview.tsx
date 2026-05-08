'use client';

import { useMemo } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { Playfair_Display } from 'next/font/google';

import type { FormValues } from '@/app/(dashboard)/app/[slug]/enquiries/create/types';
import {
  COS_BORDER,
  COS_FOREST,
  COS_FOREST_DARK,
  COS_GOLD,
  COS_GOLD_BRIGHT,
  COS_GOLD_LIGHT,
  COS_MUTED,
} from '@/lib/cosTheme';

const playfair = Playfair_Display({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

function parseNum(v: string | undefined) {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function calcTotals(menuSections: FormValues['menuSections']) {
  let sub = 0;
  const rows: { name: string; cat: string; qty: string; rate: string; line: number }[] = [];
  for (const sec of menuSections) {
    for (const it of sec.items) {
      if (!it.dish?.trim()) continue;
      const rate = parseNum(it.pricePerPlate);
      const qty = parseNum(it.quantity);
      const line = rate * qty;
      sub += line;
      rows.push({
        name: it.dish,
        cat: sec.name || '—',
        qty: qty ? String(qty) : '—',
        rate: rate ? `₹${rate.toLocaleString('en-IN')}` : '—',
        line,
      });
    }
  }
  const service = sub * 0.1;
  const preGst = sub + service;
  const gst = preGst * 0.05;
  const total = preGst + gst;
  return { sub, service, gst, total, rows };
}

function rupee(n: number) {
  return '₹ ' + Math.round(n).toLocaleString('en-IN');
}

type Props = {
  values: FormValues;
  templateName: string;
  quotationTitle: string;
  quoteNo: string;
  previewFrame: 'desktop' | 'mobile';
  onPreviewFrameChange: (f: 'desktop' | 'mobile') => void;
  businessName: string;
};

export default function CreateQuotationLivePreview({
  values,
  templateName,
  quotationTitle,
  quoteNo,
  previewFrame,
  onPreviewFrameChange,
  businessName,
}: Props) {
  const { sub, service, gst, total, rows } = useMemo(
    () => calcTotals(values.menuSections),
    [values.menuSections],
  );

  const advance = total * 0.5;
  const balance = total - advance;

  const title = quotationTitle.trim() || 'Event quotation';
  const displayDate = values.eventDate
    ? new Date(`${values.eventDate}T12:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-white shadow-sm" style={{ borderColor: COS_BORDER }}>
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: COS_BORDER, background: '#f7faf8' }}
      >
        <p className="truncate text-[12px] font-semibold uppercase tracking-wide" style={{ color: COS_FOREST }}>
          Preview — {templateName} template
        </p>
        <div className="flex shrink-0 gap-1 rounded-lg p-0.5" style={{ background: '#e8efeb' }}>
          <button
            type="button"
            aria-label="Desktop preview"
            className="rounded-md p-1.5 transition-colors"
            style={{
              background: previewFrame === 'desktop' ? '#fff' : 'transparent',
              color: previewFrame === 'desktop' ? COS_FOREST : COS_MUTED,
              boxShadow: previewFrame === 'desktop' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
            }}
            onClick={() => onPreviewFrameChange('desktop')}
          >
            <Monitor size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Mobile preview"
            className="rounded-md p-1.5 transition-colors"
            style={{
              background: previewFrame === 'mobile' ? '#fff' : 'transparent',
              color: previewFrame === 'mobile' ? COS_FOREST : COS_MUTED,
              boxShadow: previewFrame === 'mobile' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
            }}
            onClick={() => onPreviewFrameChange('mobile')}
          >
            <Smartphone size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ background: '#eef2f0' }}>
        <div
          className={`mx-auto transition-[max-width] duration-200 ${playfair.className} ${
            previewFrame === 'mobile' ? 'max-w-[340px]' : 'max-w-full'
          }`}
        >
          {/* Document */}
          <div
            className="overflow-hidden rounded-lg border bg-white shadow-md"
            style={{ borderColor: COS_BORDER }}
          >
            <header
              className="px-6 py-5"
              style={{
                background: `linear-gradient(135deg, ${COS_FOREST_DARK} 0%, ${COS_FOREST} 100%)`,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COS_GOLD_LIGHT }}>
                    {businessName}
                  </p>
                  <h2
                    className="mt-2 text-3xl font-semibold tracking-tight"
                    style={{ color: COS_GOLD_BRIGHT, fontFamily: 'inherit' }}
                  >
                    Quotation
                  </h2>
                  <p className="mt-1 text-[11px]" style={{ color: COS_GOLD_LIGHT }}>
                    {quoteNo} · {displayDate}
                  </p>
                </div>
                <div className="text-right text-[11px]" style={{ color: COS_GOLD_LIGHT }}>
                  <p className="font-semibold uppercase tracking-wide" style={{ color: COS_GOLD }}>
                    {title}
                  </p>
                </div>
              </div>
            </header>

            <div className="space-y-5 p-5 text-[13px]" style={{ color: '#1a2e28' }}>
              <div className="grid grid-cols-2 gap-4 border-b pb-4" style={{ borderColor: COS_BORDER }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COS_MUTED }}>
                    Client
                  </p>
                  <p className="mt-1 font-semibold">{values.clientName?.trim() || '—'}</p>
                  <p className="mt-0.5 text-[12px] opacity-80">{values.contactNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COS_MUTED }}>
                    Event
                  </p>
                  <p className="mt-1 font-semibold">{values.eventType || '—'}</p>
                  <p className="mt-0.5 text-[12px] opacity-80">
                    {values.guestCount ? `${values.guestCount} guests` : '—'}
                    {values.venue ? ` · ${values.venue}` : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: COS_MUTED }}>
                  Menu summary
                </p>
                <div className="overflow-hidden rounded-lg border" style={{ borderColor: COS_BORDER }}>
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr style={{ background: '#f4f7f5' }}>
                        {['Item', 'Category', 'Qty', 'Rate', 'Total'].map((h) => (
                          <th key={h} className="border-b px-3 py-2 font-semibold" style={{ borderColor: COS_BORDER }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center opacity-50">
                            Add dishes to see the menu table
                          </td>
                        </tr>
                      ) : (
                        rows.map((r, i) => (
                          <tr key={i} style={{ background: i % 2 === 1 ? '#fafcfb' : '#fff' }}>
                            <td className="border-b px-3 py-2" style={{ borderColor: COS_BORDER }}>
                              {r.name}
                            </td>
                            <td className="border-b px-3 py-2" style={{ borderColor: COS_BORDER }}>
                              {r.cat}
                            </td>
                            <td className="border-b px-3 py-2 tabular-nums" style={{ borderColor: COS_BORDER }}>
                              {r.qty}
                            </td>
                            <td className="border-b px-3 py-2 tabular-nums" style={{ borderColor: COS_BORDER }}>
                              {r.rate}
                            </td>
                            <td className="border-b px-3 py-2 tabular-nums font-medium" style={{ borderColor: COS_BORDER }}>
                              ₹{r.line.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <div className="min-w-[200px] space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-8">
                    <span style={{ color: COS_MUTED }}>Sub total</span>
                    <span className="tabular-nums font-medium">{rupee(sub)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span style={{ color: COS_MUTED }}>Service (10%)</span>
                    <span className="tabular-nums font-medium">{rupee(service)}</span>
                  </div>
                  <div className="flex justify-between gap-8">
                    <span style={{ color: COS_MUTED }}>GST (5%)</span>
                    <span className="tabular-nums font-medium">{rupee(gst)}</span>
                  </div>
                  <div
                    className="mt-2 flex justify-between gap-8 rounded-lg px-3 py-2.5 font-bold"
                    style={{ background: COS_GOLD_LIGHT, color: COS_FOREST_DARK }}
                  >
                    <span>Total</span>
                    <span className="tabular-nums">{rupee(total)}</span>
                  </div>
                </div>
              </div>

              <div
                className="grid grid-cols-2 gap-3 border-t pt-4 text-[11px] sm:grid-cols-3"
                style={{ borderColor: COS_BORDER, color: COS_GOLD_LIGHT }}
              >
                <div>
                  <p className="opacity-80">Advance (50%)</p>
                  <p className="font-semibold text-[#1a2e28]">{rupee(advance)}</p>
                </div>
                <div>
                  <p className="opacity-80">Balance</p>
                  <p className="font-semibold text-[#1a2e28]">{rupee(balance)}</p>
                </div>
              </div>
            </div>

            <footer
              className="px-6 py-3 text-center text-[11px]"
              style={{ background: COS_FOREST, color: COS_GOLD_LIGHT }}
            >
              Thank you for choosing {businessName}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
