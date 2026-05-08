'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  X,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

export interface QuotationModalRow {
  id: string;
  quote_number: string;
  event: string;
  event_code: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  version: number;
  status: string;
  subtotal: string;
  service_charge: string;
  total_amount: string;
  notes: string;
  created_at: string;
}

interface EventOption {
  id: string;
  event_code: string;
  customer_name: string;
  event_type: string;
  event_date: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: '#f0f0f0', color: '#424242' },
  SENT:     { bg: '#e3f2fd', color: '#1565c0' },
  ACCEPTED: { bg: '#e8f5e9', color: '#2e7d32' },
  REJECTED: { bg: '#ffebee', color: '#c62828' },
};

function quotationStatusLabel(status: string) {
  if (status === 'ACCEPTED') return 'APPROVED';
  return status;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f0f0f0', color: '#424242' };
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {quotationStatusLabel(status)}
    </span>
  );
}

export function PricingPanel({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: QuotationModalRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDraft     = quotation.status === 'DRAFT';
  const isFinalised = quotation.status === 'SENT' || quotation.status === 'ACCEPTED';

  const internalCost = parseFloat(Number(quotation.subtotal).toFixed(2)) || 0;
  const svcCharge    = parseFloat(Number(quotation.service_charge).toFixed(2)) || 0;
  const menuTotal    = parseFloat((internalCost + svcCharge).toFixed(2));

  const [sellingPrice, setSellingPrice]     = useState(
    parseFloat(Number(quotation.total_amount || menuTotal).toFixed(2))
  );
  const [advanceAmount, setAdvanceAmount]   = useState('');
  const [paymentTerms, setPaymentTerms]     = useState(quotation.notes || '');
  const [finalising, setFinalising]         = useState(false);

  const selling      = parseFloat(Number(sellingPrice).toFixed(2)) || 0;
  const marginNum    = internalCost > 0 ? ((selling - internalCost) / internalCost) * 100 : null;
  const marginPct    = marginNum !== null ? marginNum.toFixed(1) : null;
  const marginNeg    = marginPct !== null && parseFloat(marginPct) < 0;

  function fmtPrice(v: number) {
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleFinalise() {
    setFinalising(true);
    try {
      await api.patch(`/quotations/${quotation.id}/`, {
        status:       'SENT',
        sent_at:      new Date().toISOString(),
        total_amount: parseFloat(Number(sellingPrice).toFixed(2)),
        notes:        paymentTerms,
      });
      toast.success('Quotation finalised & sent!');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to finalise quotation');
    } finally {
      setFinalising(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col"
        style={{ maxWidth: 540, maxHeight: '92vh', border: '1px solid #E2E8F0' }}>

        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Pricing</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              {quotation.quote_number} · {quotation.client_name} · Rev. {quotation.version}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={quotation.status} />
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <X size={16} style={{ color: '#64748B' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#64748B' }}>
                Internal Cost
              </p>
              <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>Total from costing sheet</p>
              <p className="text-lg font-black" style={{ color: '#0F172A' }}>{fmtPrice(internalCost)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#3B82F6' }}>
                Calculated From Menu
              </p>
              <p className="text-xs mb-2" style={{ color: '#60A5FA' }}>Dishes + services total</p>
              <p className="text-lg font-black" style={{ color: '#1E40AF' }}>{fmtPrice(menuTotal)}</p>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: '#F1F5F9' }} />

          <div className="space-y-4">

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Final Selling Price (₹)
              </label>
              {isDraft ? (
                <input
                  type="number"
                  value={Number(sellingPrice).toFixed(2)}
                  onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-semibold"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-base font-bold" style={{ color: '#0F172A' }}>{fmtPrice(selling)}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Advance Amount (₹)
              </label>
              {isDraft ? (
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-base font-semibold" style={{ color: '#0F172A' }}>
                  {advanceAmount
                    ? fmtPrice(parseFloat(Number(advanceAmount).toFixed(2)))
                    : <span style={{ color: '#94A3B8' }}>—</span>}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#94A3B8' }}>
                Payment Terms
              </label>
              {isDraft ? (
                <textarea
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  rows={3}
                  placeholder="e.g. 50% advance, balance on event day…"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}
                />
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                  {paymentTerms || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>No payment terms specified.</span>}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#16A34A' }}>Selling</p>
              <p className="text-sm font-black" style={{ color: '#15803D' }}>
                ₹{selling.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#DC2626' }}>Cost</p>
              <p className="text-sm font-black" style={{ color: '#B91C1C' }}>
                ₹{internalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEFCE8', border: '1px solid #FDE68A' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#CA8A04' }}>Margin</p>
              <p className="text-sm font-black" style={{ color: marginNeg ? '#DC2626' : '#A16207' }}>
                {marginPct !== null ? `${marginPct}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pt-3 pb-5 shrink-0 space-y-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          {isDraft && (
            <button
              type="button"
              onClick={handleFinalise}
              disabled={finalising}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)', opacity: finalising ? 0.7 : 1 }}
            >
              {finalising
                ? <Loader2 size={14} className="animate-spin" />
                : <span>✓</span>}
              Finalise &amp; Send Quotation (Rev. {quotation.version})
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}
          >
            {isFinalised ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewQuotationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<EventOption | null>(null);
  const [creating, setCreating]   = useState(false);

  const { data: events, isLoading } = useQuery<EventOption[]>({
    queryKey: ['events-for-quotation', search],
    queryFn: () => api.get(`/events/?search=${encodeURIComponent(search)}&page_size=20`).then((r) => r.results ?? r),
    staleTime: 30_000,
  });

  function fmtModalDate(d?: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function handleCreate() {
    if (!selected) return;
    setCreating(true);
    try {
      await api.post('/quotations/', { event: selected.id });
      toast.success('Quotation created');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create quotation');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 500, border: '1px solid #E2E8F0' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>New Quotation</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Select an event to generate a quotation</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #E2E8F0' }}>
            <Search size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Search event or client name..."
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: '#0F172A' }}
              autoFocus
            />
          </div>
        </div>

        <div className="px-6 pb-3 max-h-60 overflow-y-auto space-y-1.5">
          {isLoading && (
            <div className="space-y-2 py-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg w-full" />)}
            </div>
          )}
          {!isLoading && (!events || events.length === 0) && (
            <p className="text-center text-sm py-6" style={{ color: '#94A3B8' }}>No events found</p>
          )}
          {events?.map(ev => (
            <button
              type="button"
              key={ev.id}
              onClick={() => setSelected(ev)}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
              style={{
                border: `1.5px solid ${selected?.id === ev.id ? '#16a34a' : '#E2E8F0'}`,
                background: selected?.id === ev.id ? '#F0FDF4' : '#FAFAFA',
              }}
            >
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{ev.customer_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {ev.event_code} · {ev.event_type || '—'} · {fmtModalDate(ev.event_date)}
              </p>
            </button>
          ))}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selected || creating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#D97706', opacity: (!selected || creating) ? 0.6 : 1 }}
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create Quotation
          </button>
        </div>
      </div>
    </div>
  );
}
