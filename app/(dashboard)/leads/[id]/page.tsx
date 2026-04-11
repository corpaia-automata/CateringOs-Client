'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Plus, Eye, Download, Phone, Mail,
  Users, Calendar, MapPin, IndianRupee, ChevronDown, Loader2,
  MoreHorizontal, FileText, CalendarDays, Info, X,
  MessageSquare, UserPlus, Zap, Star, Clock, Bell, TrendingUp,
  PhoneCall, CheckCircle, ArrowRight, Activity, Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';

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

interface PreEstimate {
  id: string;
  inquiry: string;
  event_type: string;
  service_type: string;
  location: string;
  guest_count: number;
  target_margin: number;
  total_cost: string | number;
  total_quote: string | number;
  total_profit: string | number;
  created_at: string;
  updated_at: string;
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
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
  NEW:       { color: C.blue,   bg: C.blueDim,   label: 'New',       glow: 'rgba(59,130,246,0.25)' },
  QUALIFIED: { color: C.purple, bg: C.purpleDim, label: 'Qualified', glow: 'rgba(139,92,246,0.25)' },
  FOLLOW_UP: { color: C.yellow, bg: C.yellowDim, label: 'Follow Up', glow: 'rgba(234,179,8,0.25)' },
  REJECTED:  { color: C.red,    bg: C.redDim,    label: 'Rejected',  glow: 'rgba(239,68,68,0.25)' },
};

const LEAD_TEMP: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  NEW:       { icon: Flame,  color: C.blue,   label: 'New Lead' },
  QUALIFIED: { icon: Star,   color: C.purple, label: 'Warm Lead' },
  FOLLOW_UP: { icon: Flame,  color: C.orange, label: 'Hot Lead' },
  REJECTED:  { icon: X,      color: C.red,    label: 'Rejected' },
};


const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW:       ['QUALIFIED', 'FOLLOW_UP', 'REJECTED'],
  QUALIFIED: ['FOLLOW_UP', 'REJECTED'],
  FOLLOW_UP: ['QUALIFIED', 'REJECTED'],
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

function fmtINR(v?: string | number) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function perPlate(total?: string | number, guests?: number) {
  if (!total || !guests || guests === 0) return '—';
  const n = typeof total === 'string' ? parseFloat(total) : total;
  if (isNaN(n)) return '—';
  return '₹' + Math.round(n / guests).toLocaleString('en-IN');
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

function StatItem({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  const accentColor = color ?? C.blue;
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group cursor-default shadow-md" >
      <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
        style={{ backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
        <Icon size={16} style={{ color: accentColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: C.muted }}>{label}</p>
        <p className="text-sm font-semibold truncate mt-0.5" style={{ color: C.text }}>{value}</p>
      </div>
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

// ─── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { color: C.muted, bg: C.surface, label: status, glow: 'transparent' };
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
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
                {['NEW', 'QUALIFIED', 'FOLLOW_UP', 'REJECTED'].map(s =>
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
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'pre-estimates' | 'quotations'>('pre-estimates');

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setRowMenuOpen(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: lead, isLoading, isError } = useQuery<LeadDetail>({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/inquiries/${id}/`),
    enabled: !!id,
  });

  const { data: preEstimatesData } = useQuery<{ results?: PreEstimate[] } | PreEstimate[]>({
    queryKey: ['lead-preestimates', id],
    queryFn: () => api.get(`/inquiries/preestimates/?inquiry=${id}`),
    enabled: !!id,
  });

  const allPreEstimates: PreEstimate[] = Array.isArray(preEstimatesData)
    ? preEstimatesData : ((preEstimatesData as { results?: PreEstimate[] })?.results ?? []);
  const sortedPreEstimates = [...allPreEstimates].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const displayedPreEstimates = sortedPreEstimates.slice(0, 3);
  const latestPreEstimate = sortedPreEstimates[0];

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

  async function handleDownloadPdf(preEstimateId: string) {
    try {
      await api.download(`/inquiries/preestimates/${preEstimateId}/export/`, `pre-estimate-${preEstimateId.slice(-6)}.pdf`);
    } catch { toast.error('Failed to download PDF'); }
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
  const budgetPerPlate = lead.estimated_budget && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof lead.estimated_budget === 'string' ? parseFloat(lead.estimated_budget) : lead.estimated_budget) / lead.guest_count) : null;
  const latestPerPlate = latestPreEstimate && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof latestPreEstimate.total_quote === 'string' ? parseFloat(latestPreEstimate.total_quote) : latestPreEstimate.total_quote) / lead.guest_count) : null;
  const showBudgetAlert = budgetPerPlate !== null && latestPerPlate !== null && latestPerPlate !== budgetPerPlate;
  const eventGuests = lead.guest_count;
  const expectedPriceStr = latestPreEstimate ? perPlate(latestPreEstimate.total_quote, eventGuests ?? 0) : 'Not Set';
  const leadTemp = LEAD_TEMP[lead.status];
  const TempIcon = leadTemp?.icon ?? Flame;

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg }}>
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

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => router.push('/leads')}
            className="flex items-center gap-1.5 text-sm font-medium transition-all duration-150 hover:opacity-70"
            style={{ color: C.muted }}>
            <ArrowLeft size={15} /> Leads
          </button>
          <span style={{ color: C.faint }}>/</span>
          <span className="text-sm font-semibold" style={{ color: 'black' }}>{lead.customer_name}</span>
        </div>

        {/* Main Grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">

          {/* ══════════════════════ LEFT MAIN CONTENT ══════════════════════ */}
          <div className="flex flex-col gap-5 min-w-0">

            {/* ── Hero Header Card ── */}
            <Card>
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">

                {/* Avatar + Info */}
                <div className="flex items-start gap-5 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex items-center justify-center w-18 h-18 rounded-2xl font-black text-xl text-black"
                      style={{ background: `linear-gradient(135deg, ${C.orange}, #fb923c)`, boxShadow: `0 8px 32px ${C.orangeDim}` }}>
                      {initials(lead.customer_name)}
                    </div>
                    <div className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-lg"
                      style={{ backgroundColor: STATUS_CONFIG[lead.status]?.color ?? C.muted, boxShadow: `0 2px 8px ${STATUS_CONFIG[lead.status]?.glow ?? 'transparent'}` }}>
                      <TempIcon size={12} color="#fff" />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <h1 className="text-2xl font-black tracking-tight truncate" style={{ color: 'black' }}>
                      {lead.customer_name}
                    </h1>
                    <p className="text-sm mt-1 truncate" style={{ color: C.muted }}>
                      {lead.event_type || '—'}
                      {lead.guest_count ? ` · ${lead.guest_count} Guests` : ''}
                      {lead.tentative_date ? ` · ${fmtDate(lead.tentative_date)}` : ''}
                    </p>
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      {lead.contact_number && (
                        <a href={`tel:${lead.contact_number}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 text-black"
                          style={{ border: `1px solid ${C.border}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.borderHi; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border; }}>
                          <Phone size={14} style={{ color: C.green }} />
                          {lead.contact_number}
                        </a>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{ color: C.text, border: `1px solid ${C.border}` }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.borderHi; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = C.border; }}>
                          <Mail size={14} style={{ color: C.blue }} />
                          {lead.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status + CTA */}
                <div className="flex flex-col gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <StatusDropdown lead={lead} onStatusChange={handleStatusChange} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setEditOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                      style={{ backgroundColor: 'GrayText', color: C.text, border: `1px solid ${C.border}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderHi; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => setDeleteOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                      style={{ backgroundColor: C.redDim, color: C.red, border: `1px solid ${C.red}30` }}>
                      <Trash2 size={14} /> Delete
                    </button>
                    <button
                      onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200"
                      style={{ background: `linear-gradient(135deg, ${C.orange}, #fb923c)`, boxShadow: `0 4px 16px ${C.orangeDim}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 24px rgba(249,115,22,0.4)`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 16px ${C.orangeDim}`; }}>
                      <Plus size={14} /> Create Pre-Estimate
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Event Information Grid ── */}
            <Card>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                  <CalendarDays size={16} style={{ color: C.blue }} />
                </div>
                <h2 className="text-base font-bold" style={{ color: C.text }}>Event Information</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatItem icon={FileText}     label="Event Type"      value={lead.event_type || '—'}                                            color={C.blue} />
                <StatItem icon={Users}        label="Guests"          value={lead.guest_count ? `${lead.guest_count} Pax` : '—'}               color={C.purple} />
                <StatItem icon={Calendar}     label="Event Date"      value={fmtDate(lead.tentative_date)} color={C.orange} />
                <StatItem icon={MapPin}       label="Location"        value={latestPreEstimate?.location || '—'} color={C.green} />
                <StatItem icon={IndianRupee}  label="Client Budget"   value={fmtINR(lead.estimated_budget)}                                    color={C.yellow} />
                <StatItem icon={TrendingUp}   label="Expected Price"  value={expectedPriceStr}                                                  color={C.teal} />
              </div>
            </Card>

            {/* ── Activity Timeline ── */}
            <Card>
              <div className="flex items-center justify-between mb-5">
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
            </Card>

            {/* ── Budget Alert ── */}
            {showBudgetAlert && budgetPerPlate !== null && latestPerPlate !== null && (
              <div className="rounded-2xl p-4 flex items-start justify-between gap-4"
                style={{ border: `1px solid ${C.yellow}30`, backgroundColor: C.yellowDim }}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                    style={{ backgroundColor: `${C.yellow}20` }}>
                    <Info size={16} style={{ color: C.yellow }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-0.5" style={{ color: C.yellow }}>Budget vs Estimate Gap</p>
                    <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
                      Latest estimate is ₹{latestPerPlate.toLocaleString('en-IN')}/plate —{' '}
                      {latestPerPlate > budgetPerPlate ? 'above' : 'below'} client budget of ₹{budgetPerPlate.toLocaleString('en-IN')}/plate.
                      {latestPerPlate > budgetPerPlate && ' Consider adjusting the menu.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap"
                  style={{ border: `1px solid ${C.yellow}40`, color: C.yellow }}>
                  View Estimate
                </button>
              </div>
            )}

            {/* ── Notes & Pre-Estimates Tabs ── */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {/* Tab Bar */}
              <div className="flex" style={{ borderBottom: `1px solid ${C.border}` }}>
                {(['pre-estimates', 'quotations'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="flex-1 px-5 py-3.5 text-sm font-semibold transition-all duration-200 capitalize"
                    style={{
                      color: activeTab === tab ? C.orange : C.muted,
                      borderBottom: activeTab === tab ? `2px solid ${C.orange}` : '2px solid transparent',
                      backgroundColor: activeTab === tab ? C.orangeDim : 'transparent',
                    }}>
                    {tab === 'pre-estimates' ? 'Pre-Estimates' : 'Notes'} {tab === 'pre-estimates' && sortedPreEstimates.length > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: C.orangeDim, color: C.orange }}>{sortedPreEstimates.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'pre-estimates' ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-medium" style={{ color: C.muted }}>
                        {sortedPreEstimates.length === 0 ? 'No pre-estimates yet' : `Showing ${displayedPreEstimates.length} of ${sortedPreEstimates.length}`}
                      </p>
                      <button onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={{ backgroundColor: C.tealDim, color: C.teal, border: `1px solid ${C.teal}30` }}>
                        <Plus size={13} /> New
                      </button>
                    </div>

                    {sortedPreEstimates.length === 0 ? (
                      <div className="text-center py-12 rounded-xl" style={{ border: `1px dashed ${C.border}` }}>
                        <FileText size={32} className="mx-auto mb-3 opacity-20" style={{ color: C.muted }} />
                        <p className="text-sm font-medium" style={{ color: C.muted }}>No pre-estimates yet.</p>
                        <button onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                          className="mt-3 text-sm font-semibold" style={{ color: C.teal }}>
                          Create your first →
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.border}` }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.surface }}>
                              {['#', 'Date', 'Guests', 'Per Plate', 'Total', ''].map(h => (
                                <th key={h} className="text-left py-2.5 px-4 text-xs font-bold uppercase tracking-wider"
                                  style={{ color: C.muted }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {displayedPreEstimates.map((pe, idx) => {
                              const peGuests = pe.guest_count ?? eventGuests ?? 0;
                              const isLatest = idx === 0;
                              return (
                                <tr key={pe.id}
                                  style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: isLatest ? `${C.orange}05` : 'transparent' }}
                                  className="transition-colors"
                                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = C.surface; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = isLatest ? `${C.orange}05` : 'transparent'; }}>
                                  <td className="py-3.5 px-4 font-bold" style={{ color: isLatest ? C.orange : C.text }}>
                                    #{sortedPreEstimates.length - idx} {isLatest && <span className="ml-1 text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: C.orangeDim, color: C.orange }}>LATEST</span>}
                                  </td>
                                  <td className="py-3.5 px-4" style={{ color: C.muted }}>{fmtDate(pe.created_at)}</td>
                                  <td className="py-3.5 px-4" style={{ color: C.muted }}>{peGuests}</td>
                                  <td className="py-3.5 px-4 font-semibold" style={{ color: C.text }}>{perPlate(pe.total_quote, peGuests)}</td>
                                  <td className="py-3.5 px-4 font-bold" style={{ color: C.text }}>{fmtINR(pe.total_quote)}</td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-1">
                                      <button title="View" onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                                        className="p-1.5 rounded-lg transition-colors"
                                        style={{ color: C.muted }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}>
                                        <Eye size={15} />
                                      </button>
                                      <button title="Download" onClick={() => handleDownloadPdf(pe.id)}
                                        className="p-1.5 rounded-lg transition-colors"
                                        style={{ color: C.muted }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}>
                                        <Download size={15} />
                                      </button>
                                      <div className="relative" ref={rowMenuOpen === pe.id ? rowMenuRef : undefined}>
                                        <button onClick={() => setRowMenuOpen(rowMenuOpen === pe.id ? null : pe.id)}
                                          className="p-1.5 rounded-lg transition-colors"
                                          style={{ color: C.muted }}
                                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
                                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                                          <MoreHorizontal size={15} />
                                        </button>
                                        {rowMenuOpen === pe.id && (
                                          <div className="absolute right-0 top-full mt-1 z-10 rounded-xl overflow-hidden shadow-2xl"
                                            style={{ minWidth: 160, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                                            <button onClick={() => { router.push(`/leads/${id}/pre-estimate`); setRowMenuOpen(null); }}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                                              style={{ color: C.text }}
                                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
                                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                                              <Eye size={14} /> View Estimate
                                            </button>
                                            <button onClick={() => { handleDownloadPdf(pe.id); setRowMenuOpen(null); }}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                                              style={{ color: C.text }}
                                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.surface; }}
                                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                                              <Download size={14} /> Download PDF
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {sortedPreEstimates.length > 3 && (
                          <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
                            <button onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                              className="flex items-center gap-1.5 text-xs font-bold"
                              style={{ color: C.teal }}>
                              View all {sortedPreEstimates.length} estimates <ArrowRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Notes Tab */
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
                )}
              </div>
            </Card>
          </div>

          {/* ══════════════════════ RIGHT SIDEBAR ══════════════════════ */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-5 self-start">

            {/* ── Quick Actions ── */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.orangeDim }}>
                  <Zap size={14} style={{ color: C.orange }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: C.text }}>Quick Actions</h3>
              </div>
              <div className="flex flex-col gap-2">
                <ActionButton icon={PhoneCall}   label="Mark Contacted"
                  onClick={() => handleStatusChange('FOLLOW_UP')}
                  variant="ghost" disabled={lead.status === 'FOLLOW_UP'} />
                <ActionButton icon={CheckCircle} label="Mark Qualified"
                  onClick={() => handleStatusChange('QUALIFIED')}
                  variant="secondary" disabled={lead.status === 'QUALIFIED'} />
                <ActionButton icon={ArrowRight}  label="Move to Follow-Up"
                  onClick={() => handleStatusChange('FOLLOW_UP')}
                  variant="ghost" disabled={lead.status === 'FOLLOW_UP'} />

                <div className="my-1" style={{ height: 1 }} />

                <ActionButton icon={FileText}    label="Create Pre-Estimate"
                  onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                  variant="primary" />
                <ActionButton icon={Plus}        label="New Quotation"
                  onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                  variant="secondary" />
                <ActionButton icon={Bell}        label="Set Reminder"
                  onClick={() => toast('Reminders coming soon')}
                  variant="ghost" />
              </div>
            </Card>

            {/* ── Stats ── */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.blueDim }}>
                  <TrendingUp size={14} style={{ color: C.blue }} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: C.text }}>Lead Stats</h3>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>Last Activity</span>
                  <span className="text-xs font-semibold" style={{ color: C.text }}>{fmtDate(lead.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>Pre-Estimates</span>
                  <span className="text-xs font-bold" style={{ color: C.teal }}>{sortedPreEstimates.length}</span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>Source</span>
                  <span className="text-xs font-semibold" style={{ color: C.text }}>{SOURCE_CHANNELS[lead.source_channel ?? ''] ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-medium" style={{ color: C.muted }}>Created</span>
                  <span className="text-xs font-semibold" style={{ color: C.text }}>{fmtDate(lead.created_at)}</span>
                </div>
              </div>
            </Card>

            {/* ── Latest Pre-Estimate Summary ── */}
            {latestPreEstimate && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.tealDim }}>
                    <FileText size={14} style={{ color: C.teal }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: C.text }}>Latest Estimate</h3>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: C.orangeDim, color: C.orange }}>#{sortedPreEstimates.length}</span>
                    <span className="text-xs" style={{ color: C.muted }}>{fmtDate(latestPreEstimate.created_at)}</span>
                  </div>
                  <p className="text-2xl font-black mb-1" style={{ color: C.text }}>{fmtINR(latestPreEstimate.total_quote)}</p>
                  <p className="text-xs mb-4" style={{ color: C.muted }}>
                    {perPlate(latestPreEstimate.total_quote, eventGuests ?? 0)} per plate · {eventGuests ?? 0} guests
                  </p>
                  <button onClick={() => router.push(`/leads/${id}/pre-estimate`)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-150"
                    style={{ backgroundColor: C.tealDim, color: C.teal, border: `1px solid ${C.teal}30` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${C.teal}25`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.tealDim; }}>
                    <Eye size={13} /> View Details
                  </button>
                </div>
              </Card>
            )}

            {/* ── Next Follow-Up ── */}
            {lead.tentative_date && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: C.purpleDim }}>
                    <Clock size={14} style={{ color: C.purple }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: C.text }}>Event Countdown</h3>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                  {(() => {
                    const eventDate = new Date(lead.tentative_date!);
                    const today = new Date();
                    const daysLeft = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const progressPct = Math.max(0, Math.min(100, 100 - (daysLeft / 180) * 100));
                    const isUrgent = daysLeft <= 14;
                    const color = isUrgent ? C.red : daysLeft <= 30 ? C.orange : C.teal;
                    return (
                      <>
                        <p className="text-2xl font-black mb-0.5" style={{ color }}>
                          {daysLeft > 0 ? `${daysLeft}d` : daysLeft === 0 ? 'Today' : 'Past'}
                        </p>
                        <p className="text-xs mb-4" style={{ color: C.muted }}>
                          {daysLeft > 0 ? 'until event · ' : 'event was · '}
                          {fmtDate(lead.tentative_date)}
                        </p>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
                        </div>
                        {isUrgent && daysLeft > 0 && (
                          <p className="text-xs mt-2 font-semibold" style={{ color: C.red }}>Urgent — follow up now!</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
