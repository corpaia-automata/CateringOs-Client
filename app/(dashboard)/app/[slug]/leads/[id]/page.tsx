'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Trash2, Plus, Eye, Download, Phone, Mail,
  Users, Calendar, MapPin, IndianRupee, ChevronDown, Loader2,
  MoreHorizontal, FileText, CalendarDays, Info, X,
  MessageSquare, UserPlus, Zap, Clock, TrendingUp, Star,
  PhoneCall, CheckCircle2, AlertCircle, ChevronRight,
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

interface InquiryQuotation {
  id: string;
  version_number: number;
  status: string;
  menu_total: string | number | null;
  internal_cost: string | number | null;
  quoted_price: string | number | null;
  inquiry: string;
  created_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string; label: string; step: number }> = {
  NEW:       { bg: '#EFF6FF', color: '#3B82F6', dot: '#3B82F6', label: 'New',       step: 0 },
  QUALIFIED: { bg: '#F5F3FF', color: '#7C3AED', dot: '#7C3AED', label: 'Qualified', step: 1 },
  FOLLOW_UP: { bg: '#FFF7ED', color: '#F97316', dot: '#F97316', label: 'Follow Up', step: 2 },
  REJECTED:  { bg: '#FEF2F2', color: '#DC2626', dot: '#DC2626', label: 'Rejected',  step: -1 },
};

const QUOTATION_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:    { bg: '#F1F5F9', color: '#64748B' },
  SENT:     { bg: '#ECFDF5', color: '#0D9488' },
  ACCEPTED: { bg: '#F0FDF4', color: '#16A34A' },
  REJECTED: { bg: '#FEF2F2', color: '#DC2626' },
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
  { label: 'WhatsApp',   value: 'WHATSAPP' },
  { label: 'Walk In',    value: 'WALK_IN' },
];

const PIPELINE_STEPS = ['NEW', 'QUALIFIED', 'FOLLOW_UP'];

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

function fmtINR(v?: string | number | null) {
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
    id: 'enquiry',
    type: 'enquiry',
    title: `Initial enquiry via ${SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'Unknown'}`,
    date: lead.created_at,
    by: 'System',
  });
  const createdDate = new Date(lead.created_at);
  createdDate.setMinutes(createdDate.getMinutes() + 1);
  items.push({
    id: 'created',
    type: 'created',
    title: 'Lead created',
    date: createdDate.toISOString(),
    by: 'Staff',
  });
  if (lead.converted_event) {
    items.push({
      id: 'converted',
      type: 'converted',
      title: 'Converted to event',
      date: lead.converted_event.created_at,
      by: 'Staff',
    });
  }
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Status Dropdown ────────────────────────────────────────────────────────────

function StatusDropdown({ lead, onStatusChange }: { lead: LeadDetail; onStatusChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const transitions = VALID_TRANSITIONS[lead.status] ?? [];
  const cfg = STATUS_CONFIG[lead.status] ?? { bg: '#F1F5F9', color: '#64748B', label: lead.status };

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => transitions.length > 0 && setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
        style={{
          backgroundColor: cfg.bg,
          color: cfg.color,
          cursor: transitions.length > 0 ? 'pointer' : 'default',
          border: `1.5px solid ${cfg.color}30`,
        }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
        {cfg.label}
        {transitions.length > 0 && <ChevronDown size={14} />}
      </button>
      {open && transitions.length > 0 && (
        <div className="absolute top-full left-0 mt-2 z-20 bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ minWidth: 180, border: '1px solid #E2E8F0' }}>
          <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ color: '#94A3B8', borderBottom: '1px solid #F1F5F9' }}>
            Move to
          </div>
          {transitions.map(ns => {
            const nc = STATUS_CONFIG[ns] ?? { bg: '#F1F5F9', color: '#64748B', label: ns };
            return (
              <button key={ns}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left hover:bg-slate-50 transition-colors"
                onClick={() => { onStatusChange(ns); setOpen(false); }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nc.color }} />
                <span style={{ color: '#0F172A' }}>{nc.label}</span>
              </button>
            );
          })}
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

  const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors';
  const ist = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };

  return (
    <>
      <div className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: 'rgba(15,23,42,0.5)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} />
      <div ref={drawerRef} className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{ width: 480, backgroundColor: '#fff', transform: open ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', transition: 'transform 0.3s ease' }}>

        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: '#0F172A' }}>Edit Lead</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Update lead information</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={18} style={{ color: '#64748B' }} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>
              Customer Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input className={inp} style={ist} required value={form.customer_name}
              onChange={e => set('customer_name', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Contact Number</label>
              <input className={inp} style={ist} type="tel" value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Email</label>
              <input className={inp} style={ist} type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Source Channel</label>
            <div className="flex gap-2 mt-1">
              {SOURCE_CHANNEL_OPTIONS.map(ch => (
                <label key={ch.value}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer flex-1 justify-center text-xs font-medium transition-all"
                  style={{
                    border: form.source_channel === ch.value ? '1.5px solid #D95F0E' : '1.5px solid #E2E8F0',
                    backgroundColor: form.source_channel === ch.value ? '#FFF7ED' : '#F8FAFC',
                    color: form.source_channel === ch.value ? '#D95F0E' : '#64748B',
                  }}>
                  <input type="radio" name="edit_source_channel" value={ch.value}
                    checked={form.source_channel === ch.value}
                    onChange={() => set('source_channel', ch.value)}
                    className="sr-only" />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Event Type</label>
            <select className={inp} style={ist} value={form.event_type} onChange={e => set('event_type', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Tentative Date</label>
              <input className={inp} style={ist} type="date" value={form.tentative_date}
                onChange={e => set('tentative_date', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Expected Guests</label>
              <input className={inp} style={ist} type="number" min="1" value={form.guest_count}
                onChange={e => set('guest_count', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Estimated Budget (₹)</label>
              <input className={inp} style={ist} type="number" min="0" step="100" value={form.estimated_budget}
                onChange={e => set('estimated_budget', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Status</label>
              <select className={inp} style={ist} value={form.status} onChange={e => set('status', e.target.value)}
                onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                >
                {['NEW', 'QUALIFIED', 'FOLLOW_UP', 'REJECTED'].map(s =>
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Notes</label>
            <textarea className={inp} style={{ ...ist, resize: 'vertical' }} rows={3} value={form.notes}
              onChange={e => set('notes', e.target.value)}
              onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 pb-4 mt-auto">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: '#64748B', border: '1.5px solid #E2E8F0' }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5 mx-auto" style={{ backgroundColor: '#FEF2F2' }}>
          <Trash2 size={26} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="text-lg font-bold text-center mb-2" style={{ color: '#0F172A' }}>Delete Lead</h3>
        <p className="text-sm text-center mb-7 leading-relaxed" style={{ color: '#64748B' }}>
          Are you sure you want to delete <span className="font-semibold" style={{ color: '#0F172A' }}>&ldquo;{name}&rdquo;</span>?<br />This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'pricing'>('overview');
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [revisingQuotation, setRevisingQuotation] = useState(false);
  const [markingLost, setMarkingLost] = useState(false);

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

  const convertedEventId = lead?.converted_event?.id;

  const { data: quotationsData } = useQuery<{ results?: Quotation[]; count?: number } | Quotation[]>({
    queryKey: ['lead-quotations', convertedEventId],
    queryFn: () => api.get(`/quotations/?event=${convertedEventId}`),
    enabled: !!convertedEventId,
  });

  const { data: inquiryQuotationsData, refetch: refetchInquiryQuotations } = useQuery<{ results?: InquiryQuotation[] } | InquiryQuotation[]>({
    queryKey: ['inquiry-quotations', id],
    queryFn: () => api.get(`/quotations/?inquiry=${id}`),
    enabled: !!id,
  });

  const allQuotations: Quotation[] = Array.isArray(quotationsData)
    ? quotationsData
    : (quotationsData?.results ?? []);

  const sortedQuotations = [...allQuotations].sort((a, b) => b.version - a.version);
  const displayedQuotations = sortedQuotations.slice(0, 3);
  const latestQuotation = sortedQuotations[0];

  const inquiryQuotations: InquiryQuotation[] = Array.isArray(inquiryQuotationsData)
    ? inquiryQuotationsData
    : (inquiryQuotationsData?.results ?? []);
  const latestInquiryQuotation = [...inquiryQuotations].sort((a, b) => b.version_number - a.version_number)[0] ?? null;

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

  async function handleMarkLost() {
    if (!lead) return;
    setMarkingLost(true);
    try {
      await api.patch(`/inquiries/${lead.id}/`, { status: 'REJECTED' });
      toast.success('Marked as lost');
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to update status');
    } finally { setMarkingLost(false); }
  }

  async function handleConvert() {
    if (!lead) return;
    setConverting(true);
    try {
      const result = await api.post(`/inquiries/${lead.id}/convert/`, {}) as { event_id?: string; id?: string };
      toast.success('Converted to event!');
      const eventId = result.event_id ?? result.id;
      if (eventId) router.push(`/events/${eventId}`);
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } };
      toast.error(e?.data?.detail ?? 'Failed to convert');
    } finally { setConverting(false); }
  }

  async function handleReviseQuotation() {
    if (!lead) return;
    setRevisingQuotation(true);
    try {
      await api.post('/quotations/', { inquiry_id: lead.id, status: 'DRAFT' });
      toast.success('New revision created');
      await refetchInquiryQuotations();
      setActiveTab('overview');
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } };
      toast.error(e?.data?.detail ?? 'Failed to create revision');
    } finally { setRevisingQuotation(false); }
  }

  async function handleSendNote() {
    if (!lead || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      await api.post(`/inquiries/${lead.id}/notes/`, { text: noteText.trim() });
      toast.success('Note added');
      setNoteText('');
      qc.invalidateQueries({ queryKey: ['lead', id] });
    } catch {
      toast.error('Failed to add note');
    } finally { setSubmittingNote(false); }
  }

  if (isLoading) return <LeadDetailSkeleton />;
  if (isError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
          <AlertCircle size={28} style={{ color: '#DC2626' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: '#0F172A' }}>Lead not found</p>
        <button onClick={() => router.push('/leads')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#1C3355' }}>
          <ArrowLeft size={16} /> Back to Leads
        </button>
      </div>
    );
  }

  const timeline = buildTimeline(lead);
  const budgetPerPlate = lead.estimated_budget && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof lead.estimated_budget === 'string' ? parseFloat(lead.estimated_budget) : lead.estimated_budget) / lead.guest_count)
    : null;
  const latestPerPlate = latestQuotation && lead.guest_count && lead.guest_count > 0
    ? Math.round((typeof latestQuotation.total_amount === 'string' ? parseFloat(latestQuotation.total_amount) : latestQuotation.total_amount) / lead.guest_count)
    : null;
  const showBudgetAlert = budgetPerPlate !== null && latestPerPlate !== null && latestPerPlate !== budgetPerPlate;
  const eventGuests = lead.converted_event?.guest_count ?? lead.guest_count;
  const cfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG['NEW'];
  const currentPipelineStep = cfg.step ?? 0;

  return (
    <>
      {editOpen && (
        <EditLeadDrawer lead={lead} open={editOpen} onClose={() => setEditOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['lead', id] })} />
      )}
      {deleteOpen && (
        <DeleteModal name={lead.customer_name} onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)} loading={deleting} />
      )}
      {newEstimateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5 mx-auto" style={{ backgroundColor: '#ECFDF5' }}>
              <FileText size={26} style={{ color: '#0D9488' }} />
            </div>
            <h3 className="text-lg font-bold text-center mb-2" style={{ color: '#0F172A' }}>New Pre-Estimate</h3>
            <p className="text-sm text-center mb-7 leading-relaxed" style={{ color: '#64748B' }}>
              This will create pre-estimate version {sortedQuotations.length + 1} for this lead.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setNewEstimateOpen(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ border: '1.5px solid #E2E8F0', color: '#64748B' }}>Cancel</button>
              <button onClick={handleNewEstimate} disabled={creatingEstimate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#0D9488', opacity: creatingEstimate ? 0.7 : 1 }}>
                {creatingEstimate && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>

        {/* ── Hero Banner ── */}
        <div style={{ background: 'linear-gradient(135deg, #1C3355 0%, #0F2040 60%, #1a3a5c 100%)' }}>
          <div className="px-6 pt-5 pb-0">

            {/* Breadcrumb */}
            <button onClick={() => router.push('/leads')}
              className="flex items-center gap-2 text-sm font-medium mb-6 transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              <ArrowLeft size={16} />
              <span>Leads</span>
              <ChevronRight size={14} style={{ opacity: 0.4 }} />
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{lead.customer_name}</span>
            </button>

            {/* Customer Info Row */}
            <div className="flex flex-col lg:flex-row lg:items-start gap-6 pb-6">

              {/* Avatar + Name + Contact */}
              <div className="flex items-start gap-5 flex-1">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #D95F0E, #F97316)' }}>
                    {initials(lead.customer_name)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white"
                    style={{ backgroundColor: lead.status === 'REJECTED' ? '#DC2626' : '#F97316' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl font-black text-white tracking-tight">{lead.customer_name}</h1>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${cfg.color}25`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {lead.event_type || '—'}
                    {lead.guest_count ? ` · ${lead.guest_count} Guests` : ''}
                    {lead.tentative_date ? ` · ${fmtDate(lead.tentative_date)}` : ''}
                  </p>
                  <div className="flex items-center gap-5 flex-wrap">
                    {lead.contact_number && (
                      <span className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        <Phone size={13} style={{ color: '#D95F0E' }} />
                        {lead.contact_number}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        <Mail size={13} style={{ color: '#D95F0E' }} />
                        {lead.email}
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <PhoneCall size={13} style={{ color: '#D95F0E' }} />
                      via {SOURCE_CHANNELS[lead.source_channel ?? ''] ?? 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <StatusDropdown lead={lead} onStatusChange={handleStatusChange} />
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => lead.converted_event ? setNewEstimateOpen(true) : toast.error('Convert lead to event first')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: lead.converted_event ? 'linear-gradient(135deg, #D95F0E, #F97316)' : 'rgba(255,255,255,0.1)', opacity: lead.converted_event ? 1 : 0.5 }}>
                  <Plus size={14} /> Pre-Estimate
                </button>
                <button onClick={() => setDeleteOpen(true)}
                  className="p-2 rounded-xl transition-all"
                  style={{ backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <Trash2 size={16} style={{ color: '#F87171' }} />
                </button>
              </div>
            </div>

            {/* Pipeline Progress */}
            {lead.status !== 'REJECTED' && (
              <div className="flex items-center gap-0 pb-0 -mb-px overflow-x-auto">
                {PIPELINE_STEPS.map((step, idx) => {
                  const sc = STATUS_CONFIG[step];
                  const isActive = step === lead.status;
                  const isDone = sc.step < currentPipelineStep;
                  return (
                    <div key={step} className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => {
                          if (!isActive && !isDone && VALID_TRANSITIONS[lead.status]?.includes(step)) {
                            handleStatusChange(step);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all whitespace-nowrap flex-1 justify-center"
                        style={{
                          color: isActive ? '#fff' : isDone ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
                          borderBottom: isActive ? `3px solid #D95F0E` : isDone ? `3px solid rgba(255,255,255,0.2)` : '3px solid transparent',
                          backgroundColor: isActive ? 'rgba(217,95,14,0.1)' : 'transparent',
                        }}>
                        {isDone ? (
                          <CheckCircle2 size={13} style={{ color: '#0D9488' }} />
                        ) : (
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                            style={{
                              backgroundColor: isActive ? '#D95F0E' : 'rgba(255,255,255,0.1)',
                              color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                            }}>
                            {idx + 1}
                          </span>
                        )}
                        {sc.label}
                      </button>
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <div className="w-px h-4 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {lead.status === 'REJECTED' && (
              <div className="flex items-center gap-2 px-4 py-3 mb-0"
                style={{ backgroundColor: 'rgba(220,38,38,0.1)', borderTop: '1px solid rgba(220,38,38,0.2)' }}>
                <AlertCircle size={14} style={{ color: '#F87171' }} />
                <span className="text-xs font-semibold" style={{ color: '#F87171' }}>
                  This lead has been marked as Rejected
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="px-6 -mt-px">
          <div className="bg-white rounded-b-2xl shadow-sm grid grid-cols-2 sm:grid-cols-4 divide-x"
            style={{ borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', divideColor: '#F1F5F9' }}>
            {[
              { icon: CalendarDays, label: 'Event Date', value: fmtDate(lead.converted_event?.event_date ?? lead.tentative_date), color: '#3B82F6' },
              { icon: Users, label: 'Guests', value: lead.guest_count ? `${lead.guest_count} Pax` : '—', color: '#7C3AED' },
              { icon: IndianRupee, label: 'Budget', value: fmtINR(lead.estimated_budget), color: '#0D9488' },
              { icon: TrendingUp, label: 'Per Plate', value: latestQuotation ? perPlate(latestQuotation.total_amount, eventGuests ?? 0) : (budgetPerPlate ? `₹${budgetPerPlate.toLocaleString('en-IN')}` : '—'), color: '#D95F0E' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: '#0F172A' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="px-6 py-5 grid gap-5 lg:grid-cols-[1fr_320px]">

          {/* ── Left Column ── */}
          <div className="flex flex-col gap-5">

            {/* Tab Navigation */}
            {latestInquiryQuotation && (
              <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                {([
                  { key: 'overview', label: 'Overview' },
                  { key: 'pricing', label: 'Pricing & Quote' },
                ] as const).map(tab => (
                  <button key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: activeTab === tab.key ? '#1C3355' : 'transparent',
                      color: activeTab === tab.key ? '#fff' : '#64748B',
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Pricing Tab Content */}
            {activeTab === 'pricing' && latestInquiryQuotation && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                      <IndianRupee size={15} style={{ color: '#3B82F6' }} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Pricing & Quote</h2>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Rev. {latestInquiryQuotation.version_number} · {latestInquiryQuotation.status}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: '#F1F5F9' }}>
                  {[
                    { label: 'Menu Total', value: fmtINR(latestInquiryQuotation.menu_total), color: '#475569' },
                    { label: 'Internal Cost', value: fmtINR(latestInquiryQuotation.internal_cost), color: '#475569' },
                    { label: 'Quoted Price', value: fmtINR(latestInquiryQuotation.quoted_price), color: '#3B82F6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white px-5 py-4 text-center">
                      <p className="text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>{label}</p>
                      <p className="text-base font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
                {lead.converted_event && (
                  <div className="px-6 py-4 flex justify-end" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <button onClick={() => router.push(`/events/${convertedEventId}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                      style={{ color: '#3B82F6', border: '1px solid #3B82F630' }}>
                      Open full editor <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Overview Tab — wrap existing cards */}
            {(activeTab === 'overview' || !latestInquiryQuotation) && (<>

            {/* Event Details Card */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <CalendarDays size={15} style={{ color: '#3B82F6' }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Event Details</h2>
                </div>
                {lead.converted_event && (
                  <button onClick={() => router.push(`/events/${convertedEventId}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors hover:bg-teal-50"
                    style={{ color: '#0D9488', border: '1px solid #0D948830' }}>
                    View Event <ChevronRight size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ backgroundColor: '#F1F5F9' }}>
                {[
                  { label: 'Event Type', value: lead.event_type || '—', icon: Star },
                  { label: 'Guest Count', value: lead.guest_count ? `${lead.guest_count} Pax` : '—', icon: Users },
                  { label: 'Event Date', value: fmtDate(lead.converted_event?.event_date ?? lead.tentative_date), icon: Calendar },
                  { label: 'Venue', value: lead.converted_event?.venue || '—', icon: MapPin },
                  { label: 'Client Budget', value: fmtINR(lead.estimated_budget), icon: IndianRupee },
                  { label: 'Budget / Plate', value: budgetPerPlate ? `₹${budgetPerPlate.toLocaleString('en-IN')}` : '—', icon: IndianRupee },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-white px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon size={12} style={{ color: '#94A3B8' }} />
                      <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{label}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget Alert */}
            {showBudgetAlert && budgetPerPlate !== null && latestPerPlate !== null && (
              <div className="rounded-2xl p-4 flex items-start justify-between gap-4"
                style={{ border: '1px solid #FDE68A', backgroundColor: '#FFFBEB' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#FEF3C7' }}>
                    <Info size={15} style={{ color: '#D97706' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-1" style={{ color: '#92400E' }}>Budget vs Estimate Mismatch</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#78350F' }}>
                      Latest estimate is ₹{latestPerPlate.toLocaleString('en-IN')}/plate —{' '}
                      <span className="font-semibold">{latestPerPlate > budgetPerPlate ? 'above' : 'below'}</span> client budget of ₹{budgetPerPlate.toLocaleString('en-IN')}/plate.
                    </p>
                  </div>
                </div>
                <button onClick={() => router.push(`/events/${convertedEventId}`)}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap"
                  style={{ border: '1.5px solid #D97706', color: '#D97706' }}>
                  Review →
                </button>
              </div>
            )}

            {/* Pre-Estimates */}
            {lead.converted_event && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
                      <FileText size={15} style={{ color: '#0D9488' }} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Pre-Estimates</h2>
                      {sortedQuotations.length > 0 && (
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{sortedQuotations.length} version{sortedQuotations.length !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setNewEstimateOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                    <Plus size={13} /> New Version
                  </button>
                </div>

                {sortedQuotations.length === 0 ? (
                  <div className="text-center py-14 px-6">
                    <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#F1F5F9' }}>
                      <FileText size={24} style={{ color: '#CBD5E1' }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#94A3B8' }}>No estimates yet</p>
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>Create the first pre-estimate for this lead</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead style={{ backgroundColor: '#F8FAFC' }}>
                        <tr>
                          {['Version', 'Date', 'Guests', 'Per Plate', 'Total', 'Status', ''].map(h => (
                            <th key={h} className="text-left py-3 px-5 text-xs font-bold uppercase tracking-wider"
                              style={{ color: '#94A3B8', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedQuotations.map((q, qIdx) => {
                          const qGuests = eventGuests ?? 0;
                          const qs = QUOTATION_STATUS_STYLE[q.status] ?? { bg: '#F1F5F9', color: '#64748B' };
                          const isLatest = qIdx === 0;
                          return (
                            <tr key={q.id} className="group hover:bg-slate-50 transition-colors"
                              style={{ borderBottom: '1px solid #F8FAFC' }}>
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold" style={{ color: '#0F172A' }}>v{q.version}</span>
                                  {isLatest && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                      style={{ backgroundColor: '#FFF7ED', color: '#D95F0E' }}>Latest</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-5 text-xs" style={{ color: '#64748B' }}>{fmtDate(q.created_at)}</td>
                              <td className="py-4 px-5 text-xs font-medium" style={{ color: '#475569' }}>{qGuests}</td>
                              <td className="py-4 px-5 text-sm font-semibold" style={{ color: '#0F172A' }}>{perPlate(q.total_amount, qGuests)}</td>
                              <td className="py-4 px-5 text-sm font-bold" style={{ color: '#0F172A' }}>{fmtINR(q.total_amount)}</td>
                              <td className="py-4 px-5">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                  style={{ backgroundColor: qs.bg, color: qs.color }}>
                                  {q.status}
                                </span>
                              </td>
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button title="View"
                                    onClick={() => router.push(`/events/${convertedEventId}`)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                    <Eye size={14} style={{ color: '#64748B' }} />
                                  </button>
                                  <button title="Download PDF"
                                    onClick={() => handleDownloadPdf(q.id)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                    <Download size={14} style={{ color: '#64748B' }} />
                                  </button>
                                  <div className="relative" ref={rowMenuOpen === q.id ? rowMenuRef : undefined}>
                                    <button onClick={() => setRowMenuOpen(rowMenuOpen === q.id ? null : q.id)}
                                      className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                      <MoreHorizontal size={14} style={{ color: '#64748B' }} />
                                    </button>
                                    {rowMenuOpen === q.id && (
                                      <div className="absolute right-0 top-full mt-1 z-10 bg-white rounded-xl shadow-xl overflow-hidden"
                                        style={{ minWidth: 150, border: '1px solid #E2E8F0' }}>
                                        <button onClick={() => { router.push(`/events/${convertedEventId}`); setRowMenuOpen(null); }}
                                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50"
                                          style={{ color: '#0F172A' }}>
                                          <Eye size={13} /> View Event
                                        </button>
                                        <button onClick={() => { handleDownloadPdf(q.id); setRowMenuOpen(null); }}
                                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50"
                                          style={{ color: '#0F172A' }}>
                                          <Download size={13} /> Download PDF
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
                    {sortedQuotations.length > 3 && (
                      <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #F1F5F9' }}>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          Showing {displayedQuotations.length} of {sortedQuotations.length} estimates
                        </p>
                        <button onClick={() => router.push(`/events/${convertedEventId}`)}
                          className="text-xs font-bold flex items-center gap-1"
                          style={{ color: '#0D9488' }}>
                          View All <ChevronRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2.5 px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
                    <MessageSquare size={15} style={{ color: '#F97316' }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Notes</h2>
                </div>
                <div className="px-6 py-4">
                  <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                    {lead.notes}
                  </p>
                </div>
              </div>
            )}
            </>)}

          </div>

          {/* ── Right Sidebar ── */}
          <div className="flex flex-col gap-5">

            {/* Status-Driven Actions */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D95F0E, #F97316)' }}>
                  <Zap size={14} className="text-white" />
                </div>
                <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Actions</h2>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {latestInquiryQuotation?.status === 'DRAFT' ? (
                  <>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl mb-1" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <span className="text-base leading-none mt-0.5">⏰</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#92400E' }}>Planning · Rev. {latestInquiryQuotation.version_number}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>Edit menu, costing & pricing freely</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('pricing')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all"
                      style={{ backgroundColor: '#3B82F6' }}>
                      $ Go to Pricing & Quote
                    </button>
                    <button onClick={handleMarkLost} disabled={markingLost}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{ color: '#DC2626', border: '1.5px solid #DC2626', backgroundColor: 'transparent', opacity: markingLost ? 0.7 : 1 }}>
                      {markingLost && <Loader2 size={14} className="animate-spin" />}
                      ✕ Mark as Lost
                    </button>
                  </>
                ) : latestInquiryQuotation?.status === 'SENT' ? (
                  <>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl mb-1" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <span className="text-base leading-none mt-0.5">🔒</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#475569' }}>Quotation Sent</p>
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Awaiting client decision</p>
                      </div>
                    </div>
                    <button onClick={handleConvert} disabled={converting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all"
                      style={{ backgroundColor: '#16A34A', opacity: converting ? 0.7 : 1 }}>
                      {converting && <Loader2 size={14} className="animate-spin" />}
                      ✓ Confirm & Convert to Event
                    </button>
                    <button onClick={handleReviseQuotation} disabled={revisingQuotation}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{ color: '#7C3AED', border: '1.5px solid #7C3AED', backgroundColor: 'transparent', opacity: revisingQuotation ? 0.7 : 1 }}>
                      {revisingQuotation && <Loader2 size={14} className="animate-spin" />}
                      ↺ Revise Quotation — Rev. {(latestInquiryQuotation.version_number ?? 0) + 1}
                    </button>
                    <button onClick={handleMarkLost} disabled={markingLost}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{ color: '#DC2626', border: '1.5px solid #DC2626', backgroundColor: 'transparent', opacity: markingLost ? 0.7 : 1 }}>
                      {markingLost && <Loader2 size={14} className="animate-spin" />}
                      ✕ Mark as Lost
                    </button>
                  </>
                ) : (
                  /* No inquiry quotation: show single pipeline transition + edit */
                  <>
                    {VALID_TRANSITIONS[lead.status]?.slice(0, 1).map(ns => {
                      const nc = STATUS_CONFIG[ns];
                      return (
                        <button key={ns}
                          onClick={() => handleStatusChange(ns)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-sm"
                          style={{ backgroundColor: `${nc.color}10`, color: nc.color, border: `1px solid ${nc.color}20` }}>
                          <span className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nc.color }} />
                            Move to {nc.label}
                          </span>
                          <ChevronRight size={14} style={{ opacity: 0.5 }} />
                        </button>
                      );
                    })}
                    <button onClick={() => setEditOpen(true)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-slate-50"
                      style={{ color: '#475569', border: '1px solid #E2E8F0' }}>
                      <span className="flex items-center gap-2.5">
                        <Pencil size={14} />
                        Edit Lead Details
                      </span>
                      <ChevronRight size={14} style={{ opacity: 0.4 }} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Summary Card */}
            {latestInquiryQuotation && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                    <IndianRupee size={14} style={{ color: '#3B82F6' }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Summary</h2>
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  {[
                    { label: 'Menu Total', value: fmtINR(latestInquiryQuotation.menu_total), highlight: false },
                    { label: 'Internal Cost', value: fmtINR(latestInquiryQuotation.internal_cost), highlight: false },
                    { label: 'Quoted Price', value: fmtINR(latestInquiryQuotation.quoted_price), highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
                      <span className="text-sm font-bold" style={{ color: highlight ? '#3B82F6' : '#0F172A' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Note Card */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFF7ED' }}>
                  <MessageSquare size={14} style={{ color: '#F97316' }} />
                </div>
                <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Add Note</h2>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note or update..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none transition-colors"
                  style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#D95F0E')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                />
                <button onClick={handleSendNote} disabled={submittingNote || !noteText.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ backgroundColor: '#D95F0E', opacity: submittingNote || !noteText.trim() ? 0.5 : 1 }}>
                  {submittingNote && <Loader2 size={14} className="animate-spin" />}
                  Send Note
                </button>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                  <Clock size={14} style={{ color: '#3B82F6' }} />
                </div>
                <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Activity</h2>
              </div>
              <div className="px-5 py-4">
                <div className="flex flex-col gap-0">
                  {timeline.map((item, idx) => {
                    const iconMap = {
                      converted: { bg: '#ECFDF5', color: '#0D9488', Icon: CheckCircle2 },
                      created:   { bg: '#EFF6FF', color: '#3B82F6', Icon: UserPlus },
                      enquiry:   { bg: '#F5F3FF', color: '#7C3AED', Icon: MessageSquare },
                      updated:   { bg: '#FFF7ED', color: '#F97316', Icon: Pencil },
                    };
                    const { bg, color, Icon } = iconMap[item.type];
                    return (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: bg }}>
                            <Icon size={14} style={{ color }} />
                          </div>
                          {idx < timeline.length - 1 && (
                            <div className="w-px flex-1 my-1.5" style={{ backgroundColor: '#F1F5F9', minHeight: 16 }} />
                          )}
                        </div>
                        <div className="pb-4 flex-1 min-w-0 pt-0.5">
                          <p className="text-xs font-semibold leading-tight mb-0.5" style={{ color: '#0F172A' }}>{item.title}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{fmtDateTime(item.date)}</p>
                          <p className="text-xs" style={{ color: '#CBD5E1' }}>by {item.by}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lead Meta Info */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <h2 className="text-sm font-bold" style={{ color: '#0F172A' }}>Lead Details</h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-3">
                {[
                  { label: 'Source', value: SOURCE_CHANNELS[lead.source_channel ?? ''] ?? '—' },
                  { label: 'Created', value: fmtDate(lead.created_at) },
                  { label: 'Last Updated', value: fmtDate(lead.updated_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
                    <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{value}</span>
                  </div>
                ))}
                {lead.converted_event && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs" style={{ color: '#94A3B8' }}>Event Code</span>
                    <button onClick={() => router.push(`/events/${convertedEventId}`)}
                      className="text-xs font-bold hover:underline" style={{ color: '#0D9488' }}>
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

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function LeadDetailSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>
      <div style={{ background: 'linear-gradient(135deg, #1C3355 0%, #0F2040 100%)' }} className="px-6 pt-5 pb-6">
        <Skeleton className="h-4 w-32 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <div className="flex items-start gap-5">
          <Skeleton className="w-20 h-20 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="flex-1">
            <Skeleton className="h-7 w-52 mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <Skeleton className="h-4 w-80 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Skeleton className="h-4 w-48" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </div>
        </div>
      </div>
      <div className="px-6 py-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
