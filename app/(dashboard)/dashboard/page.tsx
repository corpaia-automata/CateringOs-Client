'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Users, Calendar, IndianRupee, Clock,
  TrendingUp, TrendingDown, ChevronDown, FileText, ArrowRight,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardGreeting from '@/components/dashboard/DashboardGreeting';
import Link from 'next/link';

// ─── Placeholder data ─────────────────────────────────────────────────────────

const REVENUE_PLACEHOLDER = [
  { label: 'Mon', revenue: 4000 },
  { label: 'Tue', revenue: 3000 },
  { label: 'Wed', revenue: 2000 },
  { label: 'Thu', revenue: 2800 },
  { label: 'Fri', revenue: 1900 },
  { label: 'Sat', revenue: 2400 },
  { label: 'Sun', revenue: 3500 },
];

const EVENTS_DAY_PLACEHOLDER = [
  { label: 'Mon', count: 2 },
  { label: 'Tue', count: 1 },
  { label: 'Wed', count: 3 },
  { label: 'Thu', count: 2 },
  { label: 'Fri', count: 4 },
  { label: 'Sat', count: 6 },
  { label: 'Sun', count: 5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(value: number | string | undefined | null): string {
  if (value == null) return '₹0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(time?: string): string {
  if (!time) return '—';
  const [h, m] = time.split(':');
  const hour = Number(h);
  if (Number.isNaN(hour) || !m) return time;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function getDateTile(dateStr?: string) {
  if (!dateStr) return { month: '—', day: '—' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { month: '—', day: '—' };
  return {
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

function toSentenceCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

function getQuotationAction(lead: any): string {
  const status = String(lead?.latest_quotation_status || '').toLowerCase();
  if (status.includes('accept') || status.includes('won') || status.includes('confirm')) return 'Quotation accepted';
  if (status.includes('reject') || status.includes('lost')) return 'Quotation rejected';
  if (status.includes('draft')) return 'Drafting Quotation';
  if (status.includes('quote')) return 'Quotation shared';
  return lead?.has_quotation ? 'Quotation shared' : 'Drafting Quotation';
}

function getLeadFlowStatus(lead: any): 'PLANNING' | 'SUCCESS' | 'LOST' {
  const leadStatus = String(lead?.status || '').toUpperCase();
  if (leadStatus === 'SUCCESS' || leadStatus === 'LOST' || leadStatus === 'PLANNING') {
    return leadStatus as 'PLANNING' | 'SUCCESS' | 'LOST';
  }

  const quotationStatus = String(lead?.latest_quotation_status || '').toLowerCase();
  if (quotationStatus.includes('accept') || quotationStatus.includes('won') || quotationStatus.includes('confirm')) {
    return 'SUCCESS';
  }
  if (quotationStatus.includes('reject') || quotationStatus.includes('lost')) {
    return 'LOST';
  }
  return 'PLANNING';
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: '#0F172A',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        border: 'none',
      }}
    >
      <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{formatINR(payload[0].value)}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EventsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: '#0F172A',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        border: 'none',
      }}
    >
      <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{payload[0].value} events</p>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
  subtitle: string;
  subtitleIcon: React.ReactNode;
  subtitleColor: string;
  loading?: boolean;
};

function KpiCard({
  title, value, icon, iconBg, iconColor, href, subtitle, subtitleIcon, subtitleColor, loading,
}: KpiCardProps) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="group cursor-pointer rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid rgba(226,232,240,0.8)',
      }}
    >
      {/* Top row: icon + menu */}
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center rounded-xl shrink-0 transition-all duration-200 group-hover:scale-110"
          style={{
            width: 36,
            height: 36,
            background: iconBg,
          }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <button
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-slate-100 transition-colors"
          style={{ color: '#CBD5E1' }}
          aria-label="More options"
        >
          <span style={{ fontSize: 16, letterSpacing: 1, lineHeight: 1 }}>···</span>
        </button>
      </div>

      {/* Title */}
      <p
        className="font-semibold uppercase tracking-wider"
        style={{ fontSize: 10.5, color: '#94A3B8', letterSpacing: '0.08em' }}
      >
        {title}
      </p>

      {/* Value */}
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <p
          className="font-extrabold tracking-tight"
          style={{ fontSize: 28, color: '#0F172A', lineHeight: 1 }}
        >
          {value}
        </p>
      )}

      {/* Subtitle */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: subtitleColor, display: 'flex', alignItems: 'center' }}>
          {subtitleIcon}
        </span>
        <span style={{ fontSize: 12, color: subtitleColor, fontWeight: 500 }}>
          {subtitle}
        </span>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  CONFIRMED:   { bg: '#ECFDF5', color: '#059669', dot: '#10B981' },
  PAID:        { bg: '#ECFDF5', color: '#059669', dot: '#10B981' },
  DRAFT:       { bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' },
  IN_PROGRESS: { bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  PARTIAL:     { bg: '#FFF7ED', color: '#EA580C', dot: '#F97316' },
  COMPLETED:   { bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
  CANCELLED:   { bg: '#FFF1F2', color: '#BE123C', dot: '#F43F5E' },
  PENDING:     { bg: '#FFF1F2', color: '#BE123C', dot: '#F43F5E' },
};

function StatusBadge({ value }: { value: string }) {
  const s = STATUS_STYLE[value] ?? { bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: 5, height: 5, backgroundColor: s.dot }}
      />
      {toSentenceCase(value)}
    </span>
  );
}

function LeadStatusInfographic({
  status,
  hasQuotation,
  convertedEventId,
  convertedEventStatus,
}: {
  status: string;
  hasQuotation: boolean;
  convertedEventId?: string | null;
  convertedEventStatus?: string | null;
}) {
  const isSuccess = status === 'SUCCESS' || convertedEventStatus === 'CONFIRMED' || Boolean(convertedEventId);
  const isLost = status === 'LOST';
  const isQuotedStage = !isSuccess && !isLost && hasQuotation;
  const isCreatedStage = !isSuccess && !isLost && !hasQuotation;

  const createdState: 'done' | 'active' | 'pending' = isCreatedStage ? 'active' : 'done';
  const quotedState: 'done' | 'active' | 'pending' = isQuotedStage ? 'active' : (isSuccess || isLost ? 'done' : 'pending');
  const finalState: 'done' | 'active' | 'pending' = isSuccess || isLost ? 'done' : 'pending';
  const finalLabel = isSuccess ? 'WON' : isLost ? 'LOST' : 'DECISION';

  function stepStyles(stepState: 'done' | 'active' | 'pending', isFinal = false) {
    if (stepState === 'done') {
      if (isFinal && isLost) return { border: '#EF4444', color: '#EF4444', text: '#DC2626' };
      return { border: '#10B981', color: '#10B981', text: '#0F172A' };
    }
    if (stepState === 'active') {
      return { border: '#3B82F6', color: '#3B82F6', text: '#0F172A' };
    }
    return { border: '#CBD5E1', color: '#CBD5E1', text: '#94A3B8' };
  }

  const s1 = stepStyles(createdState);
  const s2 = stepStyles(quotedState);
  const s3 = stepStyles(finalState, true);
  const connector12 = isQuotedStage || isSuccess || isLost ? '#10B981' : '#CBD5E1';
  const connector23 = isSuccess ? '#10B981' : isLost ? '#9CA3AF' : '#CBD5E1';

  function OrbitNode({
    state,
    style,
    isFinal,
  }: {
    state: 'done' | 'active' | 'pending';
    style: { border: string; color: string };
    isFinal?: boolean;
  }) {
    const symbol = isLost && isFinal ? '×' : state === 'done' ? '✓' : state === 'active' ? '•' : '◌';
    return (
      <span
        className="relative w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold bg-white"
        style={{ borderColor: style.border, color: style.color }}
      >
        <span
          className="absolute inset-[5px] rounded-full border"
          style={{
            borderColor: style.border,
            opacity: state === 'pending' ? 0.5 : 0.9,
          }}
        />
        {state === 'active' && (
          <span
            className="absolute inset-[2px] rounded-full border border-dashed animate-spin"
            style={{
              borderColor: style.border,
              opacity: 0.9,
              animationDuration: '2.2s',
            }}
          />
        )}
        <span className="relative z-10">{symbol}</span>
      </span>
    );
  }

  return (
    <div className="w-[225px] shrink-0">
      <div className="relative px-2 pt-1">
        <div className="absolute left-[28px] right-[28px] top-[14px] h-[2px] rounded-full" style={{ backgroundColor: '#E2E8F0' }} />
        <div className="absolute left-[28px] top-[14px] h-[2px] rounded-full" style={{ width: 'calc(50% - 28px)', backgroundColor: connector12 }} />
        <div className="absolute left-1/2 top-[14px] h-[2px] rounded-full" style={{ width: 'calc(50% - 28px)', backgroundColor: connector23 }} />
        <div className="relative grid grid-cols-3">
          <div className="flex justify-center"><OrbitNode state={createdState} style={s1} /></div>
          <div className="flex justify-center"><OrbitNode state={quotedState} style={s2} /></div>
          <div className="flex justify-center"><OrbitNode state={finalState} style={s3} isFinal /></div>
        </div>
      </div>
      <div className="grid grid-cols-3 mt-1 text-[11px] font-semibold tracking-wide text-center">
        <span style={{ color: s1.text }}>CREATED</span>
        <span style={{ color: s2.text }}>QUOTED</span>
        <span style={{ color: s3.text }}>{finalLabel}</span>
      </div>
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white ${className}`}
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)',
        border: '1px solid rgba(226,232,240,0.8)',
      }}
    >
      {children}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

type RevenueRange = 'daily' | 'weekly' | 'monthly';

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD from an event record for calendar comparisons (includes today). */
function eventDateKey(e: Record<string, unknown>): string | null {
  const raw = e.event_date ?? e.eventDate;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) return head[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateParam(d);
}

async function getUpcomingEventsSafe() {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + 30);
  const query = `event_date_after=${formatDateParam(today)}&event_date_before=${formatDateParam(horizon)}&ordering=event_date`;
  return api.get(`/events/?${query}`);
}

function createdAtMs(lead: Record<string, unknown>): number {
  const raw = lead.created_at ?? lead.createdAt;
  if (raw == null || raw === '') return 0;
  const t = new Date(String(raw)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function DashboardPage() {
  const [revenueRange, setRevenueRange] = useState<RevenueRange>('weekly');
  const router = useRouter();

  // ── Queries ──

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-month'],
    queryFn: () => api.get('/inquiries/?ordering=-created_at'),
  });

  const { data: confirmedEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['confirmed-events'],
    queryFn: () => api.get('/events/?status=CONFIRMED'),
  });

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard/'),
  });

  const { data: upcomingEvents, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: getUpcomingEventsSafe,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-trend', revenueRange],
    queryFn: () => api.get(`/reports/revenue-trend/?range=${revenueRange}`),
  });

  // ── Derived values ──

  const leadsCount     = (leadsData as any)?.count ?? 0;
  const confirmedCount = (confirmedEvents as any)?.count ?? 0;
  const monthlyRevenue = (dashData as any)?.monthly_revenue ?? 0;
  const pendingAmount  = (dashData as any)?.pending_payment_amount ?? 0;

  const upcomingRaw: any[] = (upcomingEvents as any)?.results ?? (upcomingEvents as any) ?? [];
  const todayKey = formatDateParam(new Date());
  const upcomingList = (Array.isArray(upcomingRaw) ? upcomingRaw : [])
    .filter((e: Record<string, unknown>) => {
      const key = eventDateKey(e);
      return key != null && key >= todayKey;
    })
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const da = eventDateKey(a) ?? '';
      const db = eventDateKey(b) ?? '';
      if (da !== db) return da.localeCompare(db);
      return String(a.event_time ?? a.eventTime ?? '').localeCompare(
        String(b.event_time ?? b.eventTime ?? ''),
      );
    })
    .slice(0, 3);

  const rawRevenueTrend: any[] = (revenueData as any)?.results ?? (revenueData as any) ?? [];
  const isRevenueSample = !rawRevenueTrend?.length;
  const revenueTrend = rawRevenueTrend?.length ? rawRevenueTrend : REVENUE_PLACEHOLDER;

  const rawEventsByDay: any[] = (dashData as any)?.events_per_day ?? [];
  const isEventsDaySample = !rawEventsByDay?.length;
  const eventsByDay = rawEventsByDay?.length ? rawEventsByDay : EVENTS_DAY_PLACEHOLDER;

  const leadRows: any[] = (leadsData as any)?.results ?? (leadsData as any) ?? [];
  const recentQuotations = [...leadRows]
    .filter((lead: any) => Boolean(lead?.has_quotation) || Boolean(lead?.latest_quotation_status))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => createdAtMs(b) - createdAtMs(a))
    .slice(0, 3);

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="px-3">
        <DashboardGreeting eyebrow="Overview" />
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={leadsCount}
          icon={<Users size={16} />}
          iconBg="rgba(16,185,129,0.12)"
          iconColor="#10B981"
          href="/leads?filter=this_month"
          subtitle="+12% from last month"
          subtitleIcon={<TrendingUp size={13} />}
          subtitleColor="#10B981"
          loading={leadsLoading}
        />
        <KpiCard
          title="Confirmed Events"
          value={confirmedCount}
          icon={<Calendar size={16} />}
          iconBg="rgba(99,102,241,0.12)"
          iconColor="#6366F1"
          href="/events?status=CONFIRMED"
          subtitle="Next 30 days"
          subtitleIcon={<TrendingDown size={13} />}
          subtitleColor="#6366F1"
          loading={eventsLoading}
        />
        <KpiCard
          title="Total Revenue"
          value={formatINR(monthlyRevenue)}
          icon={<IndianRupee size={16} />}
          iconBg="rgba(99,102,241,0.10)"
          iconColor="#6366F1"
          href="/reports/revenue"
          subtitle="Confirmed events"
          subtitleIcon={<TrendingDown size={13} />}
          subtitleColor="#6366F1"
          loading={dashLoading}
        />
        <KpiCard
          title="Pending Payments"
          value={formatINR(pendingAmount)}
          icon={<Clock size={16} />}
          iconBg="rgba(244,63,94,0.10)"
          iconColor="#F43F5E"
          href="/events?payment_status=PENDING"
          subtitle="3 events overdue"
          subtitleIcon={<TrendingDown size={13} />}
          subtitleColor="#F43F5E"
          loading={dashLoading}
        />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:gap-4 lg:items-stretch">

        {/* Recent Quotations */}
        <Card className="order-2 flex w-full flex-col overflow-hidden lg:order-none lg:col-span-3 lg:row-start-1 lg:col-end-4 lg:min-w-0">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <h2 className="font-bold" style={{ fontSize: 15, color: '#0F172A' }}>Recent Quotations</h2>
            <Link href="/leads" className="font-semibold transition-colors hover:opacity-70" style={{ fontSize: 13, color: '#2563EB' }}>
              View all Enquiries
            </Link>
          </div>

          <div className="flex flex-col px-6 py-4 gap-3">
            {leadsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : recentQuotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p style={{ fontSize: 12, color: '#94A3B8' }}>No recent quotations</p>
              </div>
            ) : (
              recentQuotations.map((lead: any, index: number) => (
                <div key={lead.id ?? index} className="rounded-2xl p-5" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <span className="inline-flex items-center justify-center rounded-xl shrink-0" style={{ width: 40, height: 40, backgroundColor: '#EEF2FF', color: '#3B82F6' }}>
                        <FileText size={18} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold truncate" style={{ fontSize: 14, color: '#0F172A' }}>
                            {lead.customer_name || lead.client_name || 'Unknown Customer'}
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                            {lead.quotation_number || `QT-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`}
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                          Last Action: {getQuotationAction(lead)}
                        </p>
                      </div>
                    </div>

                    <LeadStatusInfographic
                      status={getLeadFlowStatus(lead)}
                      hasQuotation={Boolean(lead?.has_quotation)}
                      convertedEventId={lead?.converted_event_id}
                      convertedEventStatus={lead?.converted_event_status}
                    />
                  </div>

                  <div className="mt-4 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Event Date</p>
                      <p className="text-sm font-semibold mt-1" style={{ color: '#0F172A' }}>{lead.tentative_date ? fmtDate(lead.tentative_date) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Contact</p>
                      <p className="text-sm font-semibold mt-1" style={{ color: '#0F172A' }}>{lead.contact_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Est. Value</p>
                      <p className="text-sm font-bold mt-1" style={{ color: '#059669' }}>{formatINR(lead.estimated_budget)}</p>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => router.push(`/leads/${lead.id}`)}
                        className="w-full rounded-xl py-2.5 px-3 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                        style={{ border: '1px solid #E2E8F0', color: '#1E293B', backgroundColor: '#fff' }}
                      >
                        Open Quote
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Revenue Trend */}
        <Card className="order-3 p-6 lg:order-none lg:col-span-3 lg:row-start-2 lg:col-end-4 lg:min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: 'rgba(16,185,129,0.1)' }}
              >
                <TrendingUp size={13} style={{ color: '#10B981' }} />
              </div>
              <h3 className="font-bold" style={{ fontSize: 15, color: '#0F172A' }}>Revenue Trend</h3>
              {isRevenueSample && (
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>· Sample</span>
              )}
            </div>
            {/* Range selector */}
            <div className="relative">
              <div
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 cursor-pointer"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                  {revenueRange === 'daily' ? 'Last 7 Days' : revenueRange === 'weekly' ? 'Last 7 Days' : 'Monthly'}
                </span>
                <ChevronDown size={13} style={{ color: '#94A3B8' }} />
              </div>
              {/* hidden buttons for range selection */}
              <div className="absolute right-0 top-8 z-10 hidden group-hover:flex flex-col bg-white rounded-lg shadow-lg border border-slate-100 py-1">
                {(['daily', 'weekly', 'monthly'] as RevenueRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRevenueRange(r)}
                    className="px-4 py-2 text-left hover:bg-slate-50"
                    style={{ fontSize: 12, color: revenueRange === r ? '#10B981' : '#374151' }}
                  >
                    {r === 'daily' ? 'Last 7 Days' : r === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {revenueLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="contents lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col lg:gap-4 lg:self-stretch">
          {/* Upcoming Events — flex-1 uses space above Events per Day */}
          <Card className="order-1 flex min-h-[220px] w-full shrink-0 flex-col overflow-hidden lg:order-none lg:min-h-0 lg:flex-1 lg:self-stretch">
            <div className="flex shrink-0 items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center rounded-xl" style={{ width: 34, height: 34, backgroundColor: '#ECFDF5', color: '#10B981' }}>
                  <Calendar size={16} />
                </span>
                <h2 className="font-bold" style={{ fontSize: 16, color: '#0F172A' }}>Upcoming Events</h2>
              </div>
              <Link href="/events" className="font-semibold hover:opacity-80" style={{ fontSize: 14, color: '#2563EB' }}>
                View Calendar
              </Link>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
              {upcomingLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              ) : upcomingList.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-14">
                  <Calendar size={24} style={{ color: '#CBD5E1' }} />
                  <p className="mt-2 text-sm" style={{ color: '#94A3B8' }}>No upcoming events</p>
                </div>
              ) : (
                upcomingList.map((event: any) => {
                  const dateTile = getDateTile(event.event_date);
                  const eventTitle = event.client_name || event.customer_name || event.event_name || event.name || 'Untitled Event';
                  const eventType = event.event_type || 'MAIN';
                  return (
                    <button
                      key={event.id}
                      onClick={() => router.push(`/events/${event.id}`)}
                      className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-slate-50"
                      style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}
                    >
                      <div className="w-18 shrink-0 rounded-2xl text-center py-3" style={{ backgroundColor: '#FEF7E6' }}>
                        <p className="text-xs font-bold tracking-wide" style={{ color: '#D97706' }}>{dateTile.month}</p>
                        <p className="text-4 font-extrabold leading-8" style={{ color: '#B45309' }}>{dateTile.day}</p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-2xl font-extrabold truncate" style={{ color: '#0F172A' }}>{eventTitle}</p>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                            {eventType}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-5 text-sm" style={{ color: '#64748B' }}>
                          <span className="inline-flex items-center gap-1.5"><Clock size={14} />{fmtTime(event.event_time)}</span>
                          <span className="inline-flex items-center gap-1.5"><Users size={14} />{event.guest_count ?? 0} guests</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {/* Events Per Day */}
          <Card className="order-4 w-full shrink-0 p-6 lg:order-none lg:min-w-0">
            <div className="mb-5">
              <h3 className="font-bold" style={{ fontSize: 15, color: '#0F172A' }}>Events per Day</h3>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                Last 7 days
                {isEventsDaySample && <span style={{ color: '#CBD5E1' }}> · Sample</span>}
              </p>
            </div>
            {dashLoading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={eventsByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="0" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<EventsTooltip />} cursor={{ fill: 'rgba(241,245,249,0.4)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
