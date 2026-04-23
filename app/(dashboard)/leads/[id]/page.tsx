'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Plus, Phone, Mail,
  ChevronDown, Loader2,
  X, Lock, RotateCcw,
  MessageSquare, UserPlus, Zap, Star, Clock, Bell, TrendingUp,
  PhoneCall, CheckCircle, ArrowRight, Activity, Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import QuotationCard from './QuotationCard';
import LeadStatusStepper from './LeadStatusStepper';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LeadDetail {
  id: string;
  customer_name: string;
  contact_number?: string;
  email?: string;
  event_type: string;
  tentative_date?: string;
  guest_count?: number;
  estimated_budget?: string | number;
  status: string;
  source_channel?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface LeadQuotationSummary {
  id: string;
  version_number?: number;
  is_locked?: boolean;
  status?: string;
  final_selling_price?: number | string | null;
  internal_cost?: number | string | null;
  advance_amount?: number | string | null;
  payment_terms?: string;
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:        '#F3F4F6',
  surface:   '#0F1629',
  card:      'white',
  cardHover: '#182040',
  border:    'rgba(255,255,255,0.07)',
  borderHi:  'rgba(255,255,255,0.14)',
  text:      'black',
  muted:     '#64748B',
  faint:     '#334155',
  orange:    '#F97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  teal:      '#14B8A6',
  tealDim:   'rgba(20,184,166,0.15)',
  blue:      '#3B82F6',
  blueDim:   'rgba(59,130,246,0.15)',
  purple:    '#8B5CF6',
  purpleDim: 'rgba(139,92,246,0.15)',
  green:     '#22C55E',
  greenDim:  'rgba(34,197,94,0.15)',
  red:       '#EF4444',
  redDim:    'rgba(239,68,68,0.15)',
  yellow:    '#EAB308',
  yellowDim: 'rgba(234,179,8,0.15)',
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; glow: string }> = {
  PLANNING:  { color: C.orange, bg: C.orangeDim, label: 'Planning',  glow: 'rgba(249,115,22,0.25)' },
  NEW:       { color: C.blue,   bg: C.blueDim,   label: 'New',       glow: 'rgba(59,130,246,0.25)' },
  QUALIFIED: { color: C.purple, bg: C.purpleDim, label: 'Qualified', glow: 'rgba(139,92,246,0.25)' },
  FOLLOW_UP: { color: C.yellow, bg: C.yellowDim, label: 'Follow Up', glow: 'rgba(234,179,8,0.25)' },
  QUOTED:    { color: C.blue,   bg: C.blueDim,   label: 'Quoted',    glow: 'rgba(59,130,246,0.25)' },
  CONFIRMED: { color: C.green,  bg: C.greenDim,  label: 'Confirmed', glow: 'rgba(34,197,94,0.25)' },
  REJECTED:  { color: C.red,    bg: C.redDim,    label: 'Rejected',  glow: 'rgba(239,68,68,0.25)' },
};

const LEAD_TEMP: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  PLANNING:  { icon: Flame,  color: C.orange, label: 'Planning' },
  NEW:       { icon: Flame,  color: C.blue,   label: 'New Lead' },
  QUALIFIED: { icon: Star,   color: C.purple, label: 'Warm Lead' },
  FOLLOW_UP: { icon: Flame,  color: C.orange, label: 'Hot Lead' },
  QUOTED:    { icon: Star,   color: C.blue,   label: 'Quoted' },
  CONFIRMED: { icon: CheckCircle, color: C.green, label: 'Confirmed' },
  REJECTED:  { icon: X,      color: C.red,    label: 'Rejected' },
};


const VALID_TRANSITIONS: Record<string, string[]> = {
  PLANNING:  ['QUOTED', 'REJECTED'],
  NEW:       ['QUALIFIED', 'FOLLOW_UP', 'REJECTED'],
  QUALIFIED: ['FOLLOW_UP', 'REJECTED'],
  FOLLOW_UP: ['QUALIFIED', 'REJECTED'],
  QUOTED:    ['CONFIRMED', 'REJECTED', 'PLANNING'],
  CONFIRMED: [],
  REJECTED:  ['NEW'],
};

const SOURCE_CHANNELS: Record<string, string> = {
  PHONE_CALL: 'Phone Call',
  WHATSAPP:   'WhatsApp',
  WALK_IN:    'Walk In',
};

const SOURCE_CHANNEL_OPTIONS = [
  { label: 'Phone Call', value: 'PHONE_CALL' },
  { label: 'WhatsApp',   value: 'WHATSAPP'   },
  { label: 'Walk In',    value: 'WALK_IN'    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' • ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Activity Timeline Builder ─────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'converted' | 'created' | 'enquiry' | 'updated';
  title: string;
  subtitle?: string;
  date: string;
  by: string;
}

function buildTimeline(lead: LeadDetail): ActivityItem[] {
  const items: ActivityItem[] = [];
  items.push({
    id: 'enquiry', type: 'enquiry',
    title: `Initial enquiry via ${SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'Unknown'}`,
    date: lead.created_at, by: 'System',
  });
  const createdDate = new Date(lead.created_at);
  createdDate.setMinutes(createdDate.getMinutes() + 1);
  items.push({ id: 'created', type: 'created', title: 'Lead created in system', date: createdDate.toISOString(), by: 'Staff' });
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function LeadDetailSkeleton() {
  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: C.bg }}>
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-20 rounded-lg animate-pulse" style={{ backgroundColor: C.card }} />
        <div className="h-4 w-4 rounded animate-pulse" style={{ backgroundColor: C.card }} />
        <div className="h-4 w-32 rounded-lg animate-pulse" style={{ backgroundColor: C.card }} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {[160, 260, 300].map(h => (
            <div key={h} className="rounded-2xl animate-pulse" style={{ height: h, backgroundColor: C.card, border: `1px solid ${C.border}` }} />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {[280, 180, 160].map(h => (
            <div key={h} className="rounded-2xl animate-pulse" style={{ height: h, backgroundColor: C.card, border: `1px solid ${C.border}` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Components ────────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`}
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}


function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-xl
        text-sm font-medium
        bg-white text-black border border-gray-500
        hover:bg-gray-100 active:scale-[0.98]
        transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function TimelineItem({ item, isFirst, isLast }: { item: ActivityItem; isFirst: boolean; isLast: boolean }) {
  const iconMap = {
    converted: { bg: C.tealDim,   color: C.teal,   Icon: CheckCircle },
    created:   { bg: C.blueDim,   color: C.blue,   Icon: UserPlus },
    enquiry:   { bg: C.purpleDim, color: C.purple, Icon: MessageSquare },
    updated:   { bg: C.orangeDim, color: C.orange, Icon: Pencil },
  };
  const { bg, color, Icon } = iconMap[item.type];

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 z-10"
          style={{ backgroundColor: bg, border: `1px solid ${color}30`, boxShadow: isFirst ? `0 0 12px ${color}30` : 'none' }}>
          <Icon size={15} style={{ color }} />
        </div>
        {!isLast && <div className="w-px flex-1 mt-1" style={{ background: `linear-gradient(to bottom, ${color}40, transparent)`, minHeight: 28 }} />}
      </div>
      <div className={`pb-5 flex-1 min-w-0 ${isFirst ? 'opacity-100' : 'opacity-70'}`}>
        <p className="text-xs mb-1" style={{ color: C.muted }}>{fmtDateTime(item.date)}</p>
        <p className="text-sm font-semibold" style={{ color: isFirst ? C.text : C.muted }}>{item.title}</p>
        {item.subtitle && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
            style={{ backgroundColor: C.tealDim, color: C.teal }}>{item.subtitle}</span>
        )}
        <p className="text-xs mt-1" style={{ color: C.faint }}>by {item.by}</p>
      </div>
      {isFirst && (
        <div className="flex items-start pt-1">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: C.orangeDim, color: C.orange }}>LATEST</span>
        </div>
      )}
    </div>
  );
}

// ─── Edit Lead Drawer ───────────────────────────────────────────────────────────

function EditLeadDrawer({ lead, open, onClose, onSaved }: {
  lead: LeadDetail; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: lead.customer_name, contact_number: lead.contact_number ?? '',
    email: lead.email ?? '', source_channel: lead.source_channel ?? 'PHONE_CALL',
    event_type: lead.event_type ?? '', tentative_date: lead.tentative_date ?? '',
    guest_count: String(lead.guest_count ?? ''), estimated_budget: String(lead.estimated_budget ?? ''),
    status: lead.status, notes: lead.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setForm({
      customer_name: lead.customer_name, contact_number: lead.contact_number ?? '',
      email: lead.email ?? '', source_channel: lead.source_channel ?? 'PHONE_CALL',
      event_type: lead.event_type ?? '', tentative_date: lead.tentative_date ?? '',
      guest_count: String(lead.guest_count ?? ''), estimated_budget: String(lead.estimated_budget ?? ''),
      status: lead.status, notes: lead.notes ?? '',
    });
  }, [lead, open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      await api.patch(`/inquiries/${lead.id}/`, {
        customer_name: form.customer_name, contact_number: form.contact_number || '',
        email: form.email || '', source_channel: form.source_channel,
        event_type: form.event_type || '', tentative_date: form.tentative_date || null,
        guest_count: form.guest_count ? parseInt(form.guest_count) : 1,
        estimated_budget: form.estimated_budget || null,
        status: form.status, notes: form.notes || '',
      });
      toast.success('Lead updated');
      onSaved(); onClose();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown[]> };
      const msg = e?.data ? Object.values(e.data).flat().join(', ') : 'Failed to update';
      toast.error(msg as string);
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200';
  const ist: React.CSSProperties = { border: `1px solid ${C.border}`, backgroundColor: C.surface, color: C.text };
  const lbl = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';

  return (
    <>
      <div className="fixed inset-0 z-40 transition-opacity backdrop-blur-sm"
        style={{  opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} />
      <div ref={drawerRef} className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 480, backgroundColor: C.card, border: `1px solid ${C.border}`, transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-8px 0 48px rgba(0,0,0,0.5)', transition: 'transform 0.25s ease' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="font-bold text-base" style={{ color: C.text }}>Edit Lead</h2>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors" style={{ color: C.muted }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className={lbl} style={{ color: C.muted }}>Customer Name <span style={{ color: C.red }}>*</span></label>
            <input className={inp} style={ist} required value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.orangeDim}`; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: C.muted }}>Contact</label>
              <input className={inp} style={ist} type="tel" value={form.contact_number} onChange={e => set('contact_number', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.orangeDim}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div>
              <label className={lbl} style={{ color: C.muted }}>Email</label>
              <input className={inp} style={ist} type="email" value={form.email} onChange={e => set('email', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.orangeDim}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
          </div>
          <div>
            <label className={lbl} style={{ color: C.muted }}>Source Channel</label>
            <div className="flex gap-2 mt-1">
              {SOURCE_CHANNEL_OPTIONS.map(ch => (
                <label key={ch.value} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 flex-1 justify-center"
                  style={{ border: `1px solid ${form.source_channel === ch.value ? C.orange : C.border}`, backgroundColor: form.source_channel === ch.value ? C.orangeDim : C.surface }}>
                  <input type="radio" name="edit_source_channel" value={ch.value}
                    checked={form.source_channel === ch.value} onChange={() => set('source_channel', ch.value)} className="sr-only" />
                  <span className="text-xs font-medium" style={{ color: form.source_channel === ch.value ? C.orange : C.muted }}>{ch.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl} style={{ color: C.muted }}>Event Type</label>
            <select className={inp} style={ist} value={form.event_type} onChange={e => set('event_type', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border; }}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: C.muted }}>Tentative Date</label>
              <input className={inp} style={ist} type="date" value={form.tentative_date} onChange={e => set('tentative_date', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; }} />
            </div>
            <div>
              <label className={lbl} style={{ color: C.muted }}>Guests</label>
              <input className={inp} style={ist} type="number" min="1" value={form.guest_count} onChange={e => set('guest_count', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: C.muted }}>Budget (₹)</label>
              <input className={inp} style={ist} type="number" min="0" step="100" value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; }} />
            </div>
            <div>
              <label className={lbl} style={{ color: C.muted }}>Status</label>
              <select className={inp} style={ist} value={form.status} onChange={e => set('status', e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
                onBlur={e => { e.currentTarget.style.borderColor = C.border; }}>
                {['PLANNING', 'NEW', 'QUALIFIED', 'FOLLOW_UP', 'QUOTED', 'CONFIRMED', 'REJECTED'].map(s =>
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl} style={{ color: C.muted }}>Notes</label>
            <textarea className={inp} style={{ ...ist, resize: 'vertical' }} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.orange; }}
              onBlur={e => { e.currentTarget.style.borderColor = C.border; }} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 pb-4 mt-auto">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ backgroundColor: C.orange, opacity: saving ? 0.7 : 1, boxShadow: `0 4px 16px ${C.orangeDim}` }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Update Lead'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Delete Modal ───────────────────────────────────────────────────────────────

function DeleteModal({ name, onConfirm, onCancel, loading }: {
  name: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(9,14,26,0.8)' }}>
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm"
        style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4 mx-auto"
          style={{ backgroundColor: C.redDim, border: `1px solid ${C.red}30` }}>
          <Trash2 size={22} style={{ color: C.red }} />
        </div>
        <h3 className="text-base font-bold text-center mb-1" style={{ color: C.text }}>Delete Lead</h3>
        <p className="text-sm text-center mb-6" style={{ color: C.muted }}>
          Delete <span className="font-semibold" style={{ color: C.text }}>&ldquo;{name}&rdquo;</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: C.red, opacity: loading ? 0.7 : 1, boxShadow: `0 4px 16px ${C.redDim}` }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Dropdown ────────────────────────────────────────────────────────────

function StatusDropdown({ lead, onStatusChange }: { lead: LeadDetail; onStatusChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const transitions = VALID_TRANSITIONS[lead.status] ?? [];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const s = STATUS_CONFIG[lead.status] ?? { color: C.muted, bg: C.surface, glow: 'transparent' };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => transitions.length > 0 && setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}30`, cursor: transitions.length > 0 ? 'pointer' : 'default' }}>
        {lead.status.replace(/_/g, ' ')}
        {transitions.length > 0 && <ChevronDown size={14} />}
      </button>
      {open && transitions.length > 0 && (
        <div className="absolute top-full left-0 mt-2 z-20 rounded-xl overflow-hidden shadow-2xl"
          style={{ minWidth: 180, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          {transitions.map(ns => {
            const ns_s = STATUS_CONFIG[ns] ?? { color: C.muted, bg: C.surface };
            return (
              <button key={ns}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors"
                style={{ color: C.text }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                onClick={() => { onStatusChange(ns); setOpen(false); }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ns_s.color }} />
                {ns.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const quotationSectionRef = useRef<HTMLDivElement | null>(null);
  const { data: lead, isLoading, isError } = useQuery<LeadDetail>({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/inquiries/${id}/`),
    enabled: !!id,
  });
  const { data: latestQuotation } = useQuery<LeadQuotationSummary | null>({
    queryKey: ['lead-quotation-summary', id],
    queryFn: async () => {
      const raw = await api.get(`/quotations/?inquiry=${id}`);
      const quotes: LeadQuotationSummary[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
      return quotes[0] ?? null;
    },
    enabled: !!id,
  });

  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    try {
      await api.patch(`/inquiries/${lead.id}/`, { status: newStatus });
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`);
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch { toast.error('Failed to update status'); }
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    try {
      await api.delete(`/inquiries/${lead.id}/`);
      toast.success('Lead deleted');
      router.push('/leads');
    } catch { toast.error('Failed to delete lead'); }
    finally { setDeleting(false); }
  }

  async function handleAddNote() {
    const next = noteDraft.trim();
    if (!next) return;
    try {
      await api.patch(`/inquiries/${id}/`, { notes: next });
      setNoteDraft('');
      toast.success('Note added');
      await qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to add note');
    }
  }

  async function handleReviseQuotation() {
    if (!latestQuotation?.id) return;
    try {
      await api.post(`/quotations/${latestQuotation.id}/revise/`, {});
      toast.success('New quotation revision created');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['lead-quotation-summary', id] }),
        qc.invalidateQueries({ queryKey: ['quotation-menu', id] }),
        qc.invalidateQueries({ queryKey: ['lead', id] }),
      ]);
      quotationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      toast.error('Failed to revise quotation');
    }
  }

  async function handleConfirmAndConvert() {
    if (!lead) return;
    const toastId = toast.loading('Converting lead to event...');
    try {
      await api.post(`/inquiries/${lead.id}/convert/`, {});
      await api.patch(`/inquiries/${lead.id}/`, { status: 'CONFIRMED' });
      toast.success('Lead confirmed and converted to event', { id: toastId });
      router.push('/events');
      await qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to confirm and convert', { id: toastId });
    }
  }

  async function handleDownloadQuotation() {
    if (!latestQuotation?.id) {
      toast.error('No quotation available to download yet');
      return;
    }
    try {
      const safeName = (lead?.customer_name || 'client').replace(/[\\/:*?"<>|]/g, '').trim() || 'client';
      await api.download(`/quotations/${latestQuotation.id}/export-pdf/`, `${quoteId} — ${safeName}.pdf`);
    } catch {
      toast.error('Failed to download quotation');
    }
  }


  if (isLoading) return <LeadDetailSkeleton />;
  if (isError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" style={{ backgroundColor: C.bg }}>
        <p className="text-base font-medium" style={{ color: C.muted }}>Lead not found.</p>
        <button onClick={() => router.push('/leads')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: C.orange, color: '#fff' }}>
          <ArrowLeft size={16} /> Back to Leads
        </button>
      </div>
    );
  }

  const timeline = buildTimeline(lead);
  const leadTemp = LEAD_TEMP[lead.status];
  const TempIcon = leadTemp?.icon ?? Flame;
  const quoteId = `QT-${new Date().getFullYear()}-${id.slice(-4).toUpperCase().padStart(4, '0')}`;
  const sourceChannelLabel = SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'General';
  const leadStatus = lead.status;
  const quotationVersion = latestQuotation?.version_number ?? 1;
  const isQuotationLocked = Boolean(latestQuotation?.is_locked);
  const quotedPrice = Number(latestQuotation?.final_selling_price ?? 0);
  const internalCost = Number(latestQuotation?.internal_cost ?? 0);
  const advance = Number(latestQuotation?.advance_amount ?? 0);
  const menuTotal = quotedPrice;
  const fmtMoney = (value: number) => `₹${(Number.isFinite(value) ? value : 0).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen max-w-7xl mx-auto" style={{ backgroundColor: C.bg }}>
      {/* Overlays / Drawers */}
      {editOpen && (
        <EditLeadDrawer lead={lead} open={editOpen} onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['lead', id] })} />
      )}
      {deleteOpen && (
        <DeleteModal name={lead.customer_name} onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)} loading={deleting} />
      )}
      <div className="max-w-screen-2xl mx-auto px-4 py-5">

        {/* Lead Detail Header */}
        <div className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => router.push('/leads')}
                className="mt-1 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-black/10 hover:bg-black/5 transition-colors"
                aria-label="Back to leads"
              >
                <ArrowLeft size={15} style={{ color: C.muted }} />
              </button>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight truncate" style={{ color: C.text }}>
                  {quoteId}
                </h1>
                <p className="text-sm mt-1" style={{ color: C.muted }}>
                  Created {fmtDate(lead.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleDownloadQuotation()}
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black hover:bg-black/5 transition-colors"
              >
                Download Quotation
              </button>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                style={{
                  color: STATUS_CONFIG[lead.status]?.color ?? C.blue,
                  backgroundColor: STATUS_CONFIG[lead.status]?.bg ?? C.blueDim,
                  borderColor: `${STATUS_CONFIG[lead.status]?.color ?? C.blue}33`,
                }}
              >
                {STATUS_CONFIG[lead.status]?.label ?? lead.status}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black">
                {lead.event_type || 'Event'}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border border-black/10 text-black">
                {sourceChannelLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Client', value: lead.customer_name },
              { label: 'Venue', value: lead.notes?.trim() ? lead.notes : '—' },
              { label: 'Date & Time', value: lead.tentative_date ? fmtDateTime(lead.tentative_date) : '—' },
              { label: 'Guests', value: lead.guest_count ? `${lead.guest_count} people` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-black/10 px-3 py-2.5">
                <p className="text-xs font-medium" style={{ color: C.muted }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: C.text }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <LeadStatusStepper status={lead.status} />
        </div>

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">

          {/* ══════════════════════ LEFT MAIN CONTENT ══════════════════════ */}
          <div className="flex flex-col gap-5 min-w-0">

            {/* ── Hero Header Card ── */}
          

            {/* ── Quotation Card ── */}
            <div ref={quotationSectionRef}>
              <QuotationCard
                leadId={id}
                clientName={lead.customer_name}
                eventDate={lead.tentative_date}
                guestCount={lead.guest_count}
                eventType={lead.event_type}
              />
            </div>

            {/* ── Activity Timeline ── */}
            {/* <Card> */}
              {/* <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: C.purpleDim }}>
                    <Activity size={16} style={{ color: C.purple }} />
                  </div>
                  <h2 className="text-base font-bold" style={{ color: C.text }}>Activity Timeline</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: C.surface, color: C.muted, border: `1px solid ${C.border}` }}>
                  {timeline.length} events
                </span>
              </div>
              <div className="flex flex-col">
                {timeline.map((item, idx) => (
                  <TimelineItem key={item.id} item={item} isFirst={idx === 0} isLast={idx === timeline.length - 1} />
                ))}
              </div>
            </Card> */}

            {/* ── Notes ── */}
            {/* <Card>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl p-4" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                  <p className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Lead Notes</p>
                  {lead.notes ? (
                    <p className="text-sm leading-relaxed" style={{ color: C.text }}>{lead.notes}</p>
                  ) : (
                    <p className="text-sm italic" style={{ color: C.faint }}>No notes added yet. Edit the lead to add notes.</p>
                  )}
                </div>
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-fit"
                  style={{ backgroundColor: C.surface, color: C.text, border: `1px solid ${C.border}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderHi; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}>
                  <Pencil size={14} /> {lead.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
            </Card> */}
          </div>

          {/* ══════════════════════ RIGHT SIDEBAR ══════════════════════ */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-5 self-start">
            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold tracking-wide text-slate-600 mb-4">ACTIONS</p>
              {(leadStatus === 'PLANNING' || leadStatus === 'NEW' || leadStatus === 'QUALIFIED' || leadStatus === 'FOLLOW_UP') && (
                <>
                  <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#F4CD53', backgroundColor: '#FFF8E5' }}>
                    <p className="text-orange-600 font-semibold text-md">Planning</p>
                    <p className="text-orange-500 text-sm mt-0.5">
                      {isQuotationLocked ? 'Pricing is locked for current revision' : 'Edit menu, costing & pricing freely'}
                    </p>
                  </div>
                  {!isQuotationLocked ? (
                    <button
                      type="button"
                      onClick={() => quotationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="w-full rounded-2xl px-4 py-2 text-white text-xl font-semibold mb-3 inline-flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(180deg, #5F4BFF 0%, #4338CA 100%)' }}
                    >
                      <CheckCircle size={20} />
                      Finalize &amp; Send Quotation
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReviseQuotation()}
                      className="w-full rounded-2xl px-4 py-2 text-indigo-700 text-lg font-semibold mb-3 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={18} />
                      Revise Quotation
                    </button>
                  )}
                </>
              )}

              {leadStatus === 'QUOTED' && (
                <>
                  <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                    <p className="text-blue-700 font-semibold text-md inline-flex items-center gap-2">
                      <Lock size={16} />
                      Quotation Sent
                    </p>
                    <p className="text-blue-600 text-sm mt-0.5">Awaiting client decision • Rev {quotationVersion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleConfirmAndConvert()}
                    className="w-full rounded-2xl px-4 py-2 text-white text-md font-semibold mb-2 bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={20} />
                    Confirm &amp; Convert to Event
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReviseQuotation()}
                    className="w-full rounded-2xl px-4 py-2 text-indigo-700 text-md font-semibold mb-3 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors inline-flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RotateCcw size={18} />
                      Revise Quotation
                    </span>
                    <span className="text-sm font-semibold">→ Rev {quotationVersion + 1}</span>
                  </button>
                </>
              )}

              {leadStatus === 'CONFIRMED' && (
                <div className="rounded-2xl border px-4 py-2 mb-4" style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }}>
                  <p className="text-emerald-700 font-semibold text-md">Event Confirmed</p>
                  <p className="text-emerald-600 text-sm mt-0.5">Use event workflow actions only.</p>
                </div>
              )}

              {(leadStatus === 'PLANNING' || leadStatus === 'NEW' || leadStatus === 'QUALIFIED' || leadStatus === 'FOLLOW_UP' || leadStatus === 'QUOTED') && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('REJECTED')}
                  className="w-full rounded-2xl border px-4 py-2 text-red-600 text-md font-semibold hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-2"
                  style={{ borderColor: '#F4B4B4' }}
                >
                  <X size={18} />
                  Mark as Lost
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold tracking-wide text-slate-600 mb-4">SUMMARY</p>
              <div className="space-y-2 text-md leading-tight">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Menu Total</span>
                  <span className="font-semibold text-black">{fmtMoney(menuTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Internal Cost</span>
                  <span className="font-semibold text-black">{fmtMoney(internalCost)}</span>
                </div>
                <div className="border-t border-black/10 pt-2 mt-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Quoted Price</span>
                  <span className="font-bold text-indigo-600">{fmtMoney(quotedPrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Advance</span>
                  <span className="font-semibold text-emerald-600">{fmtMoney(advance)}</span>
                </div>
                <div className="text-xs text-slate-500 pt-1">Rev {quotationVersion} {isQuotationLocked ? '• Locked' : '• Editable'}</div>
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
              <p className="text-lg font-semibold tracking-wide text-slate-600 mb-4">ADD NOTE</p>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                rows={4}
                placeholder="Add a note or update..."
                className="w-full rounded-2xl border border-slate-300 px-4 py-2 text-lg text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="button"
                onClick={() => void handleAddNote()}
                className="w-full mt-4 rounded-2xl px-4 py-2 text-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: '#8D96A2' }}
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
