'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Plus, Eye, Download, Phone, Mail,
  Users, Calendar, MapPin, IndianRupee, ChevronDown, Loader2,
  MoreHorizontal, FileText, CalendarDays, Info, X, Check,
  MessageSquare, UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConvertedEvent {
  id: string;
  event_code?: string;
  venue?: string;
  event_date?: string;
  guest_count: number;
  total_amount?: string | number;
  status: string;
  created_at: string;
}

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
  converted_event?: ConvertedEvent | null;
}

interface Quotation {
  id: string;
  version: number;
  created_at: string;
  total_amount: string | number;
  status: string;
  event: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  NEW:        { bg: '#EFF6FF', color: '#3B82F6' },
  QUALIFIED:  { bg: '#F5F3FF', color: '#7C3AED' },
  FOLLOW_UP:  { bg: '#FFF7ED', color: '#F97316' },
  CONVERTED:  { bg: '#ECFDF5', color: '#0D9488' },
  LOST:       { bg: '#FEF2F2', color: '#DC2626' },
};

const QUOTATION_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: '#F1F5F9', color: '#64748B' },
  SENT:     { bg: '#ECFDF5', color: '#0D9488' },
  ACCEPTED: { bg: '#F0FDF4', color: '#16A34A' },
  REJECTED: { bg: '#FEF2F2', color: '#DC2626' },
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW:        ['QUALIFIED', 'FOLLOW_UP', 'LOST'],
  QUALIFIED:  ['FOLLOW_UP', 'CONVERTED', 'LOST'],
  FOLLOW_UP:  ['QUALIFIED', 'CONVERTED', 'LOST'],
  CONVERTED:  [],
  LOST:       ['NEW'],
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

  // Initial enquiry
  items.push({
    id: 'enquiry',
    type: 'enquiry',
    title: `Initial enquiry received via ${SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'Unknown'}`,
    date: lead.created_at,
    by: 'System',
  });

  // Lead created
  const createdDate = new Date(lead.created_at);
  createdDate.setMinutes(createdDate.getMinutes() + 1);
  items.push({
    id: 'created',
    type: 'created',
    title: 'Lead created',
    date: createdDate.toISOString(),
    by: 'Staff',
  });

  // Converted
  if (lead.status === 'CONVERTED' && lead.converted_event) {
    items.push({
      id: 'converted',
      type: 'converted',
      title: 'Lead converted to event',
      date: lead.converted_event.created_at,
      by: 'Staff',
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  const iconMap = {
    converted: { bg: '#ECFDF5', color: '#0D9488', Icon: Check },
    created:   { bg: '#EFF6FF', color: '#3B82F6', Icon: UserPlus },
    enquiry:   { bg: '#F5F3FF', color: '#7C3AED', Icon: MessageSquare },
    updated:   { bg: '#FFF7ED', color: '#F97316', Icon: Pencil },
  };
  const { bg, color, Icon } = iconMap[type];
  return (
    <div className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
      style={{ backgroundColor: bg }}>
      <Icon size={15} style={{ color }} />
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status, map }: { status: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[status] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Snapshot Stat Cell ─────────────────────────────────────────────────────────

function SnapCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
      <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mt-0.5"
        style={{ backgroundColor: '#EFF6FF' }}>
        <Icon size={16} style={{ color: '#3B82F6' }} />
      </div>
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Edit Lead Drawer ───────────────────────────────────────────────────────────

function EditLeadDrawer({ lead, open, onClose, onSaved }: {
  lead: LeadDetail; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customer_name:    lead.customer_name,
    contact_number:   lead.contact_number ?? '',
    email:            lead.email ?? '',
    source_channel:   lead.source_channel ?? 'PHONE_CALL',
    event_type:       lead.event_type ?? '',
    tentative_date:   lead.tentative_date ?? '',
    guest_count:      String(lead.guest_count ?? ''),
    estimated_budget: String(lead.estimated_budget ?? ''),
    status:           lead.status,
    notes:            lead.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm({
        customer_name:    lead.customer_name,
        contact_number:   lead.contact_number ?? '',
        email:            lead.email ?? '',
        source_channel:   lead.source_channel ?? 'PHONE_CALL',
        event_type:       lead.event_type ?? '',
        tentative_date:   lead.tentative_date ?? '',
        guest_count:      String(lead.guest_count ?? ''),
        estimated_budget: String(lead.estimated_budget ?? ''),
        status:           lead.status,
        notes:            lead.notes ?? '',
      });
    }
  }, [lead, open]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
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
        customer_name:    form.customer_name,
        contact_number:   form.contact_number || '',
        email:            form.email || '',
        source_channel:   form.source_channel,
        event_type:       form.event_type || '',
        tentative_date:   form.tentative_date || null,
        guest_count:      form.guest_count ? parseInt(form.guest_count) : 1,
        estimated_budget: form.estimated_budget || null,
        status:           form.status,
        notes:            form.notes || '',
      });
      toast.success('Lead updated');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown[]> };
      const msg = e?.data ? Object.values(e.data).flat().join(', ') : 'Failed to update';
      toast.error(msg as string);
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const ist = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const lbl = 'block text-xs font-medium mb-1';

  return (
    <>
      <div className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} />
      <div ref={drawerRef} className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 460, backgroundColor: '#fff', transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', transition: 'transform 0.25s ease' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
          <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>Edit Lead</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} style={{ color: '#64748B' }} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          <div><label className={lbl} style={{ color: '#0F172A' }}>Customer Name <span style={{ color: '#DC2626' }}>*</span></label>
            <input className={inp} style={ist} required value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: '#0F172A' }}>Contact Number</label>
              <input className={inp} style={ist} type="tel" value={form.contact_number} onChange={e => set('contact_number', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
            <div><label className={lbl} style={{ color: '#0F172A' }}>Email</label>
              <input className={inp} style={ist} type="email" value={form.email} onChange={e => set('email', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
          </div>

          <div><label className={lbl} style={{ color: '#0F172A' }}>Source Channel</label>
            <div className="flex gap-3 mt-1">
              {SOURCE_CHANNEL_OPTIONS.map(ch => (
                <label key={ch.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="edit_source_channel" value={ch.value}
                    checked={form.source_channel === ch.value} onChange={() => set('source_channel', ch.value)}
                    className="accent-[#D95F0E]" />
                  <span className="text-xs" style={{ color: '#0F172A' }}>{ch.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div><label className={lbl} style={{ color: '#0F172A' }}>Event Type</label>
            <select className={inp} style={ist} value={form.event_type} onChange={e => set('event_type', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: '#0F172A' }}>Tentative Date</label>
              <input className={inp} style={ist} type="date" value={form.tentative_date} onChange={e => set('tentative_date', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
            <div><label className={lbl} style={{ color: '#0F172A' }}>Expected Guests</label>
              <input className={inp} style={ist} type="number" min="1" value={form.guest_count} onChange={e => set('guest_count', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: '#0F172A' }}>Estimated Budget (₹)</label>
              <input className={inp} style={ist} type="number" min="0" step="100" value={form.estimated_budget} onChange={e => set('estimated_budget', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>
            <div><label className={lbl} style={{ color: '#0F172A' }}>Status</label>
              <select className={inp} style={ist} value={form.status} onChange={e => set('status', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                disabled={lead.status === 'CONVERTED'}>
                {['NEW', 'QUALIFIED', 'FOLLOW_UP', 'CONVERTED', 'LOST'].map(s =>
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select></div>
          </div>

          <div><label className={lbl} style={{ color: '#0F172A' }}>Notes</label>
            <textarea className={inp} style={{ ...ist, resize: 'vertical' }} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} /></div>

          <div className="flex items-center justify-end gap-3 pt-2 pb-4 mt-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#D95F0E', opacity: saving ? 0.7 : 1 }}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto" style={{ backgroundColor: '#FEF2F2' }}>
          <Trash2 size={22} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="text-base font-semibold text-center mb-1" style={{ color: '#0F172A' }}>Delete Lead</h3>
        <p className="text-sm text-center mb-6" style={{ color: '#64748B' }}>
          Are you sure you want to delete <span className="font-medium" style={{ color: '#0F172A' }}>"{name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }}>
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

  const s = STATUS_STYLE[lead.status] ?? { bg: '#F1F5F9', color: '#64748B' };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => transitions.length > 0 && setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity"
        style={{ backgroundColor: s.bg, color: s.color, cursor: transitions.length > 0 ? 'pointer' : 'default' }}>
        {lead.status.replace(/_/g, ' ')}
        {transitions.length > 0 && <ChevronDown size={14} />}
      </button>
      {open && transitions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-xl shadow-xl overflow-hidden"
          style={{ minWidth: 160, border: '1px solid #E2E8F0' }}>
          {transitions.map(ns => {
            const ns_s = STATUS_STYLE[ns] ?? { bg: '#F1F5F9', color: '#64748B' };
            return (
              <button key={ns}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 transition-colors"
                style={{ color: '#0F172A' }}
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
  const [newEstimateOpen, setNewEstimateOpen] = useState(false);
  const [creatingEstimate, setCreatingEstimate] = useState(false);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Close row menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenuOpen(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Queries ──
  const { data: lead, isLoading, isError } = useQuery<LeadDetail>({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/inquiries/${id}/`),
    enabled: !!id,
  });

  const convertedEventId = lead?.converted_event?.id;

  const { data: quotationsData } = useQuery<{ results?: Quotation[]; count?: number } | Quotation[]>({
    queryKey: ['lead-quotations', convertedEventId],
    queryFn: () => api.get(`/quotations/?event=${convertedEventId}`),
    enabled: !!convertedEventId,
  });

  // Normalize quotations (paginated or plain array)
  const allQuotations: Quotation[] = Array.isArray(quotationsData)
    ? quotationsData
    : (quotationsData?.results ?? []);

  // Sort by version desc (newest first)
  const sortedQuotations = [...allQuotations].sort((a, b) => b.version - a.version);
  const displayedQuotations = sortedQuotations.slice(0, 3);
  const latestQuotation = sortedQuotations[0];

  // ── Handlers ──
  async function handleStatusChange(newStatus: string) {
    if (!lead) return;
    try {
      await api.patch(`/inquiries/${lead.id}/`, { status: newStatus });
      toast.success(`Status changed to ${newStatus.replace(/_/g, ' ')}`);
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleDelete() {
    if (!lead) return;
    setDeleting(true);
    try {
      await api.delete(`/inquiries/${lead.id}/`);
      toast.success('Lead deleted');
      router.push('/leads');
    } catch {
      toast.error('Failed to delete lead');
    } finally { setDeleting(false); }
  }

  async function handleNewEstimate() {
    if (!convertedEventId) return;
    setCreatingEstimate(true);
    try {
      await api.post('/quotations/', { event: convertedEventId });
      toast.success('New pre-estimate created');
      qc.invalidateQueries({ queryKey: ['lead-quotations', convertedEventId] });
      setNewEstimateOpen(false);
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } };
      toast.error(e?.data?.detail ?? 'Failed to create estimate');
    } finally { setCreatingEstimate(false); }
  }

  async function handleDownloadPdf(quotationId: string) {
    try {
      await api.download(`/quotations/${quotationId}/pdf/`, `pre-estimate-${quotationId.slice(-6)}.pdf`);
    } catch {
      toast.error('Failed to download PDF');
    }
  }

  // ── Loading / Error ──
  if (isLoading) return <LeadDetailSkeleton />;
  if (isError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-base font-medium" style={{ color: '#64748B' }}>Lead not found.</p>
        <button onClick={() => router.push('/leads')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#0F172A', color: '#fff' }}>
          <ArrowLeft size={16} /> Back to Leads
        </button>
      </div>
    );
  }

  // ── Computed ──
  const timeline = buildTimeline(lead);
  const budgetPerPlate = lead.estimated_budget && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof lead.estimated_budget === 'string' ? parseFloat(lead.estimated_budget) : lead.estimated_budget) / lead.guest_count)
    : null;
  const latestPerPlate = latestQuotation && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof latestQuotation.total_amount === 'string' ? parseFloat(latestQuotation.total_amount) : latestQuotation.total_amount) / lead.guest_count)
    : null;
  const showBudgetAlert = budgetPerPlate !== null && latestPerPlate !== null && latestPerPlate !== budgetPerPlate;

  const eventGuests = lead.converted_event?.guest_count ?? lead.guest_count;
  const expectedPriceStr = latestQuotation
    ? perPlate(latestQuotation.total_amount, eventGuests ?? 0)
    : 'Not Set';

  return (
    <>
      {/* Overlay / Drawers */}
      {editOpen && (
        <EditLeadDrawer
          lead={lead}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['lead', id] })}
        />
      )}
      {deleteOpen && (
        <DeleteModal
          name={lead.customer_name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
          loading={deleting}
        />
      )}

      {/* New Estimate Confirm Modal */}
      {newEstimateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" style={{ border: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto" style={{ backgroundColor: '#ECFDF5' }}>
              <FileText size={22} style={{ color: '#0D9488' }} />
            </div>
            <h3 className="text-base font-semibold text-center mb-1" style={{ color: '#0F172A' }}>New Pre-Estimate</h3>
            <p className="text-sm text-center mb-6" style={{ color: '#64748B' }}>
              This will create a new pre-estimate (version {sortedQuotations.length + 1}) for this lead.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setNewEstimateOpen(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>Cancel</button>
              <button onClick={handleNewEstimate} disabled={creatingEstimate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#0D9488', opacity: creatingEstimate ? 0.7 : 1 }}>
                {creatingEstimate && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className=" p-4 w-full mx-auto">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => router.push('/leads')}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
            style={{ color: '#64748B' }}>
            <ArrowLeft size={16} /> Leads
          </button>
          <span style={{ color: '#CBD5E1' }}>/</span>
          <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{lead.customer_name}</span>
        </div>

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-2xl mb-5 p-6" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">

            {/* Avatar + Info */}
            <div className="flex items-start gap-4 flex-1">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl font-bold text-xl text-white shrink-0"
                style={{ backgroundColor: '#D95F0E' }}>
                {initials(lead.customer_name)}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>{lead.customer_name}</h1>
                  <StatusBadge status={lead.status} map={STATUS_STYLE} />
                </div>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  {lead.event_type || '—'}
                  {lead.guest_count ? ` • ${lead.guest_count} Guests` : ''}
                  {lead.tentative_date ? ` • ${fmtDate(lead.tentative_date)}` : ''}
                  {lead.converted_event?.venue ? ` • ${lead.converted_event.venue}` : ''}
                </p>
                <div className="flex items-center gap-5 mt-2 flex-wrap">
                  {lead.contact_number && (
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#475569' }}>
                      <Phone size={14} style={{ color: '#94A3B8' }} />
                      {lead.contact_number}
                    </span>
                  )}
                  {lead.email && (
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#475569' }}>
                      <Mail size={14} style={{ color: '#94A3B8' }} />
                      {lead.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Lead Status */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Lead Status</p>
              <StatusDropdown lead={lead} onStatusChange={handleStatusChange} />
              {lead.status === 'CONVERTED' && lead.converted_event && (
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  Converted on {fmtDate(lead.converted_event.created_at)}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>Actions</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0F172A' }}>
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ border: '1.5px solid #FEE2E2', color: '#DC2626', backgroundColor: '#FEF2F2' }}>
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => lead.converted_event ? setNewEstimateOpen(true) : toast.error('Convert lead to event first')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity"
                  style={{ backgroundColor: '#0F172A', opacity: lead.converted_event ? 1 : 0.5 }}>
                  <Plus size={14} /> Create Pre-Estimate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Two Column Layout ── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* ── Left Column ── */}
          <div className="flex flex-col gap-5">

            {/* Event Snapshot */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={18} style={{ color: '#0F172A' }} />
                <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>Event Snapshot</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SnapCell icon={FileText} label="Event Type" value={lead.event_type || '—'} />
                <SnapCell icon={Users} label="Guests" value={lead.guest_count ? `${lead.guest_count} Pax` : '—'} />
                <SnapCell icon={Calendar} label="Date" value={fmtDate(lead.converted_event?.event_date ?? lead.tentative_date)} />
                <SnapCell icon={MapPin} label="Location" value={lead.converted_event?.venue || '—'} />
                <SnapCell icon={IndianRupee} label="Budget (Client)" value={fmtINR(lead.estimated_budget)} />
                <SnapCell icon={IndianRupee} label="Expected Price" value={expectedPriceStr} />
              </div>
            </div>

            {/* Pre-Estimates — only for converted leads */}
            {lead.converted_event && (
              <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText size={18} style={{ color: '#0F172A' }} />
                    <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>Pre-Estimates</h2>
                  </div>
                  <button onClick={() => setNewEstimateOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: '#0D9488' }}>
                    <Plus size={14} /> New Pre-Estimate
                  </button>
                </div>

                {sortedQuotations.length === 0 ? (
                  <div className="text-center py-10" style={{ color: '#94A3B8' }}>
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No pre-estimates yet. Create your first one.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                            {['#', 'Date', 'Guests', 'Per Plate', 'Total Amount', 'Status', 'Actions'].map(h => (
                              <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                                style={{ color: '#94A3B8' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedQuotations.map(q => {
                            const qGuests = eventGuests ?? 0;
                            const qs = QUOTATION_STATUS_STYLE[q.status] ?? { bg: '#F1F5F9', color: '#64748B' };
                            return (
                              <tr key={q.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                                className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 font-medium" style={{ color: '#0F172A' }}>{q.version}</td>
                                <td className="py-3 px-3" style={{ color: '#475569' }}>{fmtDate(q.created_at)}</td>
                                <td className="py-3 px-3" style={{ color: '#475569' }}>{qGuests}</td>
                                <td className="py-3 px-3 font-medium" style={{ color: '#0F172A' }}>{perPlate(q.total_amount, qGuests)}</td>
                                <td className="py-3 px-3 font-medium" style={{ color: '#0F172A' }}>{fmtINR(q.total_amount)}</td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: qs.bg, color: qs.color }}>
                                    {q.status}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1">
                                    <button title="View"
                                      onClick={() => router.push(`/events/${convertedEventId}`)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                      <Eye size={15} style={{ color: '#64748B' }} />
                                    </button>
                                    <button title="Download PDF"
                                      onClick={() => handleDownloadPdf(q.id)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                      <Download size={15} style={{ color: '#64748B' }} />
                                    </button>
                                    <button title="Edit"
                                      onClick={() => router.push(`/events/${convertedEventId}`)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                      <Pencil size={15} style={{ color: '#64748B' }} />
                                    </button>
                                    <div className="relative" ref={rowMenuOpen === q.id ? rowMenuRef : undefined}>
                                      <button
                                        onClick={() => setRowMenuOpen(rowMenuOpen === q.id ? null : q.id)}
                                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                        <MoreHorizontal size={15} style={{ color: '#64748B' }} />
                                      </button>
                                      {rowMenuOpen === q.id && (
                                        <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl shadow-xl overflow-hidden"
                                          style={{ minWidth: 140, border: '1px solid #E2E8F0' }}>
                                          <button onClick={() => { router.push(`/events/${convertedEventId}`); setRowMenuOpen(null); }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50"
                                            style={{ color: '#0F172A' }}>
                                            <Eye size={14} /> View Event
                                          </button>
                                          <button onClick={() => { handleDownloadPdf(q.id); setRowMenuOpen(null); }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50"
                                            style={{ color: '#0F172A' }}>
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
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        Showing 1-{displayedQuotations.length} of {sortedQuotations.length}
                      </p>
                      {sortedQuotations.length > 3 && (
                        <button onClick={() => router.push(`/events/${convertedEventId}`)}
                          className="flex items-center gap-1 text-xs font-semibold"
                          style={{ color: '#0D9488' }}>
                          View All Estimates →
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Budget vs Estimate Alert */}
            {showBudgetAlert && budgetPerPlate !== null && latestPerPlate !== null && (
              <div className="rounded-2xl p-4 flex items-start justify-between gap-4"
                style={{ border: '1px solid #FDE68A', backgroundColor: '#FFFBEB' }}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: '#FEF3C7' }}>
                    <Info size={15} style={{ color: '#D97706' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: '#92400E' }}>Budget vs Estimate</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                      Latest estimate per plate is ₹{latestPerPlate.toLocaleString('en-IN')} which is{' '}
                      {latestPerPlate > budgetPerPlate ? 'above' : 'below'} client budget of ₹{budgetPerPlate.toLocaleString('en-IN')}.
                      {latestPerPlate > budgetPerPlate && ' Consider adjusting menu or removing extras.'}
                    </p>
                  </div>
                </div>
                <button onClick={() => router.push(`/events/${convertedEventId}`)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={{ border: '1.5px solid #D97706', color: '#D97706' }}>
                  View Suggestion
                </button>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
                <h2 className="text-base font-semibold mb-3" style={{ color: '#0F172A' }}>Notes</h2>
                <p className="text-sm leading-relaxed p-3 rounded-lg" style={{ color: '#334155', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  {lead.notes}
                </p>
              </div>
            )}
          </div>

          {/* ── Right Sidebar: Activity Timeline ── */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>Activity Timeline</h2>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ border: '1px solid #E2E8F0', color: '#64748B' }}>
                  All Activities <ChevronDown size={12} />
                </button>
              </div>

              <div className="flex flex-col gap-0">
                {timeline.map((item, idx) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <ActivityIcon type={item.type} />
                      {idx < timeline.length - 1 && (
                        <div className="w-px flex-1 my-1" style={{ backgroundColor: '#E2E8F0', minHeight: 20 }} />
                      )}
                    </div>
                    <div className="pb-5 flex-1 min-w-0">
                      <p className="text-xs mb-0.5" style={{ color: '#94A3B8' }}>{fmtDateTime(item.date)}</p>
                      <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{item.title}</p>
                      {item.subtitle && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                          style={{ backgroundColor: '#ECFDF5', color: '#0D9488' }}>
                          {item.subtitle}
                        </span>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>by {item.by}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-2 text-sm font-medium text-center py-2 rounded-lg hover:bg-slate-50 transition-colors"
                style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>
                View Full Activity →
              </button>
            </div>

            {/* Quick Info Card */}
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>Lead Info</h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Source</span>
                  <span className="text-xs font-medium" style={{ color: '#0F172A' }}>
                    {SOURCE_CHANNELS[lead.source_channel ?? ''] ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Created</span>
                  <span className="text-xs font-medium" style={{ color: '#0F172A' }}>{fmtDate(lead.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Last Updated</span>
                  <span className="text-xs font-medium" style={{ color: '#0F172A' }}>{fmtDate(lead.updated_at)}</span>
                </div>
                {lead.converted_event && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#94A3B8' }}>Event Code</span>
                    <button onClick={() => router.push(`/events/${convertedEventId}`)}
                      className="text-xs font-semibold hover:underline" style={{ color: '#0D9488' }}>
                      {lead.converted_event.event_code ?? '—'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────────

function LeadDetailSkeleton() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <Skeleton className="h-4 w-32 mb-5" />
      <div className="bg-white rounded-2xl p-6 mb-5" style={{ border: '1px solid #E2E8F0' }}>
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-72 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
