'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { parseGuestCount } from '@/lib/utils';

// ─── Design tokens — mirrors leads/[id]/page.tsx exactly ──────────────────────
const C = {
  card:      '#ffffff',
  surface:   '#0F1629',
  border:    'rgba(255,255,255,0.07)',
  text:      '#0F172A',
  muted:     '#64748B',
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  red:       '#EF4444',
};

const SOURCE_CHANNEL_OPTIONS = [
  { label: 'Phone Call', value: 'PHONE_CALL' },
  { label: 'WhatsApp',   value: 'WHATSAPP'   },
  { label: 'Walk In',    value: 'WALK_IN'    },
];

const EMPTY_FORM = {
  customer_name:    '',
  contact_number:   '',
  email:            '',
  source_channel:   'PHONE_CALL',
  event_type:       '',
  tentative_date:   '',
  guest_count:      '',
  estimated_budget: '',
  status:           'PLANNING',
  venue:            '',
  notes:            '',
};

export interface LeadFormLead {
  id: string;
  customer_name: string;
  contact_number?: string;
  email?: string;
  source_channel?: string;
  event_type?: string;
  tentative_date?: string;
  guest_count?: number;
  estimated_budget?: string | number;
  status?: string;
  venue?: string;
  notes?: string;
}

interface LeadFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** null = create mode, LeadFormLead = edit mode */
  editing: LeadFormLead | null;
  /** Called after a successful save. Receives the new lead id when creating. */
  onSaved: (newId?: string) => void;
  /**
   * 'drawer'  – fixed right-side slide-over (default, used on list & detail pages)
   * 'page'    – inline card, no fixed positioning (used on /leads/new dedicated page)
   */
  mode?: 'drawer' | 'page';
}

// ─── Shared form fields ────────────────────────────────────────────────────────

function FormFields({
  form,
  set,
  onClose,
  saving,
  isEdit,
  mode,
}: {
  form: typeof EMPTY_FORM;
  set: (k: string, v: string) => void;
  onClose: () => void;
  saving: boolean;
  isEdit: boolean;
  mode: 'drawer' | 'page';
}) {
  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200';
  const ist: React.CSSProperties = {
    border: '1.5px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
    color: C.text,
  };
  const lbl = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = C.orange;
    e.currentTarget.style.boxShadow   = `0 0 0 3px ${C.orangeDim}`;
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = '#E2E8F0';
    e.currentTarget.style.boxShadow   = 'none';
  }

  return (
    <>
      {/* Customer Name */}
      <div>
        <label className={lbl} style={{ color: C.muted }}>
          Customer Name <span style={{ color: C.red }}>*</span>
        </label>
        <input
          className={inp} style={ist} required
          placeholder="Full name"
          value={form.customer_name}
          onChange={e => set('customer_name', e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Contact + Email */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} style={{ color: C.muted }}>Contact</label>
          <input
            className={inp} style={ist} type="tel"
            placeholder="+91 9XXXXXXXXX"
            value={form.contact_number}
            onChange={e => set('contact_number', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label className={lbl} style={{ color: C.muted }}>Email</label>
          <input
            className={inp} style={ist} type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
      </div>

      {/* Source Channel */}
      <div>
        <label className={lbl} style={{ color: C.muted }}>Source Channel</label>
        <div className="flex gap-2 mt-1">
          {SOURCE_CHANNEL_OPTIONS.map(ch => {
            const active = form.source_channel === ch.value;
            return (
              <label
                key={ch.value}
                className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 flex-1 justify-center"
                style={{
                  border: `1px solid ${active ? C.orange : '#E2E8F0'}`,
                  backgroundColor: active ? C.orangeDim : '#F8FAFC',
                }}
              >
                <input
                  type="radio"
                  name={isEdit ? 'edit_source_channel' : 'new_source_channel'}
                  value={ch.value}
                  checked={active}
                  onChange={() => set('source_channel', ch.value)}
                  className="sr-only"
                />
                <span className="text-xs font-medium" style={{ color: active ? C.orange : C.muted }}>
                  {ch.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Event Type */}
      <div>
        <label className={lbl} style={{ color: C.muted }}>Event Type</label>
        <select
          className={inp} style={ist}
          value={form.event_type}
          onChange={e => set('event_type', e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
        >
          <option value="">Select event type</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Date + Guests */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} style={{ color: C.muted }}>Tentative Date</label>
          <input
            className={inp} style={ist} type="date"
            value={form.tentative_date}
            onChange={e => set('tentative_date', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label className={lbl} style={{ color: C.muted }}>Guests</label>
          <input
            className={inp} style={ist} type="number" min="1"
            placeholder="e.g. 200"
            value={form.guest_count}
            onChange={e => set('guest_count', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
      </div>

      {/* Budget + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} style={{ color: C.muted }}>Budget (₹)</label>
          <input
            className={inp} style={ist} type="number" min="0" step="100"
            placeholder="e.g. 50000"
            value={form.estimated_budget}
            onChange={e => set('estimated_budget', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          />
        </div>
        <div>
          <label className={lbl} style={{ color: C.muted }}>Status</label>
          <select
            className={inp} style={ist}
            value={form.status}
            onChange={e => set('status', e.target.value)}
            onFocus={onFocus} onBlur={onBlur}
          >
            {['PLANNING', 'SUCCESS', 'LOST'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Venue */}
      <div>
        <label className={lbl} style={{ color: C.muted }}>Venue</label>
        <input
          className={inp} style={ist}
          placeholder="Venue / hall name"
          value={form.venue}
          onChange={e => set('venue', e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Notes */}
      <div>
        <label className={lbl} style={{ color: C.muted }}>Notes</label>
        <textarea
          className={inp} style={{ ...ist, resize: 'vertical' }}
          rows={3}
          placeholder="Additional notes…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-3 pt-2 pb-4 mt-auto"
        style={mode === 'page' ? { borderTop: '1px solid #E2E8F0', paddingTop: 16 } : {}}
      >
        <button
          type="button" onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ color: C.muted, border: '1.5px solid #E2E8F0' }}
        >
          Cancel
        </button>
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{ backgroundColor: C.orange, opacity: saving ? 0.7 : 1, boxShadow: `0 4px 16px ${C.orangeDim}` }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : isEdit ? 'Update Lead' : 'Create Lead'}
        </button>
      </div>
    </>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function LeadFormDrawer({
  open,
  onClose,
  editing,
  onSaved,
  mode = 'drawer',
}: LeadFormDrawerProps) {
  const isEdit = Boolean(editing);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Sync form when editing lead changes or drawer opens
  useEffect(() => {
    if (editing) {
      setForm({
        customer_name:    editing.customer_name ?? '',
        contact_number:   editing.contact_number ?? '',
        email:            editing.email ?? '',
        source_channel:   editing.source_channel ?? 'PHONE_CALL',
        event_type:       editing.event_type ?? '',
        tentative_date:   editing.tentative_date ?? '',
        guest_count:      editing.guest_count != null
          ? String(parseGuestCount(editing.guest_count)) : '',
        estimated_budget: editing.estimated_budget != null
          ? String(editing.estimated_budget) : '',
        status:           editing.status ?? 'PLANNING',
        venue:            editing.venue ?? '',
        notes:            editing.notes ?? '',
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
  }, [editing, open]);

  // Close on outside click (drawer mode only)
  useEffect(() => {
    if (mode !== 'drawer') return;
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, mode]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        customer_name:    form.customer_name.trim(),
        contact_number:   form.contact_number || '',
        email:            form.email || '',
        source_channel:   form.source_channel,
        event_type:       form.event_type || '',
        tentative_date:   form.tentative_date || null,
        guest_count:      parseGuestCount(form.guest_count),
        estimated_budget: form.estimated_budget || null,
        status:           form.status,
        venue:            form.venue.trim() || '',
        notes:            form.notes || '',
      };

      if (isEdit && editing) {
        await api.patch(`/inquiries/${editing.id}/`, payload);
        toast.success('Lead updated');
        onSaved();
      } else {
        const result = await api.post('/inquiries/', payload) as { id?: string };
        toast.success('Lead created');
        onSaved(result?.id);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown[]> };
      const msg = e?.data
        ? Object.values(e.data).flat().join(', ')
        : isEdit ? 'Failed to update' : 'Failed to create lead';
      toast.error(msg as string);
    } finally {
      setSaving(false);
    }
  }

  // ── Page mode: render as an inline card (no fixed positioning) ──────────────
  if (mode === 'page') {
    return (
      <div
        className="rounded-2xl flex flex-col gap-4 p-6 shadow-sm"
        style={{ backgroundColor: C.card, border: '1px solid rgba(0,0,0,0.08)' }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormFields
            form={form} set={set} onClose={onClose}
            saving={saving} isEdit={isEdit} mode="page"
          />
        </form>
      </div>
    );
  }

  // ── Drawer mode: fixed right-side slide-over ────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* Panel */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 480,
          backgroundColor: C.card,
          border: `1px solid rgba(0,0,0,0.08)`,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.12)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #E2E8F0' }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: C.text }}>
              {isEdit ? 'Edit Lead' : 'Create New Lead'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              {isEdit
                ? 'Update the lead details below.'
                : 'Fill in the details to create a new lead.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors hover:bg-slate-100"
            style={{ color: C.muted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4"
        >
          <FormFields
            form={form} set={set} onClose={onClose}
            saving={saving} isEdit={isEdit} mode="drawer"
          />
        </form>
      </div>
    </>
  );
}
