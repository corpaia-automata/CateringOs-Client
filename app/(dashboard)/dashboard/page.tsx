'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Users, Calendar, IndianRupee, AlertCircle,
  ArrowRight, TrendingUp, UtensilsCrossed,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

// ─── Placeholder data ─────────────────────────────────────────────────────────

const REVENUE_PLACEHOLDER = [
  { label: 'Oct', revenue: 45000 },
  { label: 'Nov', revenue: 62000 },
  { label: 'Dec', revenue: 38000 },
  { label: 'Jan', revenue: 71000 },
  { label: 'Feb', revenue: 55000 },
  { label: 'Mar', revenue: 80000 },
];

const EVENTS_DAY_PLACEHOLDER = [
  { label: 'Mon', count: 1 },
  { label: 'Tue', count: 0 },
  { label: 'Wed', count: 2 },
  { label: 'Thu', count: 1 },
  { label: 'Fri', count: 3 },
  { label: 'Sat', count: 2 },
  { label: 'Sun', count: 1 },
];

const DISHES_PLACEHOLDER = [
  { dish_name: 'Chicken Biryani', total_quantity: 1800 },
  { dish_name: 'Mutton Curry',    total_quantity: 1300 },
  { dish_name: 'Ghee Rice',       total_quantity: 900  },
  { dish_name: 'Raita',           total_quantity: 600  },
  { dish_name: 'Papad',           total_quantity: 400  },
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

function toSentenceCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
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
  glowColor: string;
  href: string;
  loading?: boolean;
};

function KpiCard({
  title, value, icon, iconBg, iconColor, glowColor, href, loading,
}: KpiCardProps) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="group cursor-pointer rounded-2xl px-5 py-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid rgba(226,232,240,0.8)',
      }}
    >
      {/* Row 1: Icon + Label */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-xl shrink-0 transition-all duration-200 group-hover:scale-110"
          style={{
            width: 32,
            height: 32,
            background: iconBg,
            boxShadow: `0 0 0 3px ${glowColor}`,
          }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <p
          className="font-medium tracking-wide uppercase truncate"
          style={{ fontSize: 11, color: '#94A3B8', letterSpacing: '0.06em' }}
        >
          {title}
        </p>
      </div>

      {/* Row 2: Value */}
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <p
          className="font-bold tracking-tight"
          style={{ fontSize: 26, color: '#0F172A', lineHeight: 1.1 }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  CONFIRMED:   { bg: '#ECFDF5', color: '#059669', dot: '#10B981' },
  DRAFT:       { bg: '#F8FAFC', color: '#64748B', dot: '#94A3B8' },
  IN_PROGRESS: { bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  COMPLETED:   { bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
  CANCELLED:   { bg: '#FFF1F2', color: '#BE123C', dot: '#F43F5E' },
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

type EventFilter = 'today' | 'next7' | 'weekly';
type RevenueRange = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
  const [eventFilter, setEventFilter] = useState<EventFilter>('next7');
  const [revenueRange, setRevenueRange] = useState<RevenueRange>('weekly');

  // ── Queries ──

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-month'],
    queryFn: () => api.get('/inquiries/?created_month=current'),
  });

  const { data: confirmedEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['confirmed-events'],
    queryFn: () => api.get('/events/?status=CONFIRMED&upcoming=true'),
  });

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard/'),
  });

  const { data: upcomingEvents, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming-events', eventFilter],
    queryFn: () => api.get(`/events/?upcoming=true&filter=${eventFilter}`),
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['revenue-trend', revenueRange],
    queryFn: () => api.get(`/reports/revenue-trend/?range=${revenueRange}`),
  });

  const { data: topDishes, isLoading: dishesLoading } = useQuery({
    queryKey: ['top-dishes'],
    queryFn: () => api.get('/reports/top-dishes/'),
  });

  // ── Derived values ──

  const leadsCount     = (leadsData as any)?.count ?? 0;
  const confirmedCount = (confirmedEvents as any)?.count ?? 0;
  const monthlyRevenue = (dashData as any)?.monthly_revenue ?? 0;
  const pendingAmount  = (dashData as any)?.pending_payment_amount ?? 0;

  const upcomingList: any[] = (upcomingEvents as any)?.results ?? (upcomingEvents as any) ?? [];

  const rawRevenueTrend: any[] = (revenueData as any)?.results ?? (revenueData as any) ?? [];
  const isRevenueSample = !rawRevenueTrend?.length;
  const revenueTrend = rawRevenueTrend?.length ? rawRevenueTrend : REVENUE_PLACEHOLDER;

  const rawEventsByDay: any[] = (dashData as any)?.events_per_day ?? [];
  const isEventsDaySample = !rawEventsByDay?.length;
  const eventsByDay = rawEventsByDay?.length ? rawEventsByDay : EVENTS_DAY_PLACEHOLDER;

  const rawDishes: any[] = (topDishes as any)?.results ?? (topDishes as any) ?? [];
  const isDishesSample = !rawDishes?.length;
  const dishes = rawDishes?.length ? rawDishes : DISHES_PLACEHOLDER;

  const maxQty = dishes.length > 0 ? Math.max(...dishes.map((d: any) => d.total_quantity)) : 1;

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 pb-8">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={leadsCount}
          icon={<Users size={16} />}
          iconBg="linear-gradient(135deg, #10B981, #059669)"
          iconColor="#fff"
          glowColor="rgba(16,185,129,0.12)"
          href="/leads?filter=this_month"
          loading={leadsLoading}
        />
        <KpiCard
          title="Confirmed Events"
          value={confirmedCount}
          icon={<Calendar size={16} />}
          iconBg="linear-gradient(135deg, #3B82F6, #2563EB)"
          iconColor="#fff"
          glowColor="rgba(59,130,246,0.12)"
          href="/events?status=CONFIRMED"

          loading={eventsLoading}
        />
        <KpiCard
          title="Total Revenue"
          value={formatINR(monthlyRevenue)}
          icon={<IndianRupee size={16} />}
          iconBg="linear-gradient(135deg, #F59E0B, #D97706)"
          iconColor="#fff"
          glowColor="rgba(245,158,11,0.12)"
          href="/reports/revenue"
          loading={dashLoading}
        />
        <KpiCard
          title="Pending Payments"
          value={formatINR(pendingAmount)}
          icon={<AlertCircle size={16} />}
          iconBg="linear-gradient(135deg, #F43F5E, #E11D48)"
          iconColor="#fff"
          glowColor="rgba(244,63,94,0.12)"
          href="/events?payment_status=PENDING"
          loading={dashLoading}
        />
      </div>

      {/* ── Main 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── LEFT: Upcoming Events Table (3/5) ── */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div>
              <h2 className="font-semibold" style={{ fontSize: 14, color: '#0F172A' }}>
                Upcoming Events
              </h2>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Scheduled catering engagements</p>
            </div>
            {/* Filter tabs */}
            <div
              className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              {(['today', 'next7', 'weekly'] as EventFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className="px-3 py-1.5 rounded-md transition-all duration-150 font-medium"
                  style={{
                    fontSize: 11,
                    background: eventFilter === f ? '#fff' : 'transparent',
                    color: eventFilter === f ? '#0F172A' : '#94A3B8',
                    boxShadow: eventFilter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {f === 'today' ? 'Today' : f === 'next7' ? 'Next 7 days' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>

          {/* Table body */}
          <div className="overflow-x-auto flex-1">
            {upcomingLoading ? (
              <div className="p-6 flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : upcomingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20" style={{ color: '#CBD5E1' }}>
                <div
                  className="flex items-center justify-center rounded-2xl mb-4"
                  style={{ width: 56, height: 56, background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                >
                  <Calendar size={24} style={{ color: '#CBD5E1' }} />
                </div>
                <p className="font-medium" style={{ fontSize: 14, color: '#94A3B8' }}>No upcoming events</p>
                <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>Events will appear here once scheduled</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                    {['Event', 'Date', 'Venue', 'Guests', 'Status'].map(h => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left font-medium uppercase tracking-wide"
                        style={{ fontSize: 10, color: '#94A3B8', letterSpacing: '0.07em' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingList.map((event: any) => (
                    <tr
                      key={event.id}
                      onClick={() => { window.location.href = `/events/${event.id}`; }}
                      className="group cursor-pointer transition-colors duration-150"
                      style={{ borderBottom: '1px solid #F8FAFC' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold" style={{ fontSize: 13, color: '#0F172A' }}>
                          {event.event_name || event.name || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap" style={{ fontSize: 12, color: '#64748B' }}>
                        {event.event_date ? fmtDate(event.event_date) : '—'}
                      </td>
                      <td className="px-5 py-4 max-w-30 truncate" style={{ fontSize: 12, color: '#64748B' }}>
                        {event.venue || '—'}
                      </td>
                      <td className="px-5 py-4" style={{ fontSize: 12, color: '#64748B' }}>
                        {event.guest_count != null ? (
                          <span className="font-medium" style={{ color: '#0F172A' }}>{event.guest_count}</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={event.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}
          >
            <p style={{ fontSize: 12, color: '#94A3B8' }}>{upcomingList.length} event{upcomingList.length !== 1 ? 's' : ''} shown</p>
            <Link
              href="/events"
              className="flex items-center gap-1 font-semibold transition-colors duration-150 hover:opacity-70"
              style={{ fontSize: 12, color: '#10B981' }}
            >
              View all events <ArrowRight size={12} />
            </Link>
          </div>
        </Card>

        {/* ── RIGHT: Analytics (2/5) ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Revenue Trend */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 28, height: 28, background: 'rgba(16,185,129,0.1)' }}
                >
                  <TrendingUp size={13} style={{ color: '#10B981' }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ fontSize: 13, color: '#0F172A' }}>Revenue Trend</h3>
                  {isRevenueSample && (
                    <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 400 }}>Sample data</span>
                  )}
                </div>
              </div>
              <div
                className="flex items-center gap-0.5 rounded-lg p-0.5"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
              >
                {(['daily', 'weekly', 'monthly'] as RevenueRange[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRevenueRange(r)}
                    className="px-2.5 py-1 rounded-md transition-all duration-150 font-medium"
                    style={{
                      fontSize: 10,
                      background: revenueRange === r ? '#fff' : 'transparent',
                      color: revenueRange === r ? '#0F172A' : '#94A3B8',
                      boxShadow: revenueRange === r ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {revenueLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#CBD5E1' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#CBD5E1' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Events Per Day */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ fontSize: 13, color: '#0F172A' }}>Events per day</h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                  Last 7 days
                  {isEventsDaySample && <span style={{ color: '#CBD5E1' }}> · Sample</span>}
                </p>
              </div>
            </div>
            {dashLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={eventsByDay} margin={{ top: 0, right: 4, left: -24, bottom: 0 }} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#CBD5E1' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#CBD5E1' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<EventsTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {eventsByDay.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.label === todayLabel ? '#10B981' : '#E2E8F0'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top Dishes */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: 'rgba(245,158,11,0.1)' }}
              >
                <UtensilsCrossed size={13} style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ fontSize: 13, color: '#0F172A' }}>Top dishes</h3>
                {isDishesSample && (
                  <span style={{ fontSize: 10, color: '#CBD5E1' }}>Sample data</span>
                )}
              </div>
            </div>
            {dishesLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : dishes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8" style={{ color: '#CBD5E1' }}>
                <UtensilsCrossed size={28} className="mb-2 opacity-40" />
                <p style={{ fontSize: 12 }}>No dish data available</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dishes.slice(0, 7).map((dish: any, i: number) => {
                  const pct = maxQty > 0 ? (dish.total_quantity / maxQty) * 100 : 0;
                  // gradient: top dish gets full green, others fade
                  const barColor = i === 0 ? '#10B981' : i === 1 ? '#34D399' : '#A7F3D0';
                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-semibold shrink-0 flex items-center justify-center rounded-md"
                            style={{
                              fontSize: 10,
                              width: 18,
                              height: 18,
                              background: i < 3 ? 'rgba(16,185,129,0.1)' : '#F8FAFC',
                              color: i < 3 ? '#10B981' : '#94A3B8',
                            }}
                          >
                            {i + 1}
                          </span>
                          <span className="truncate max-w-27.5" style={{ fontSize: 12, fontWeight: 500, color: '#0F172A' }}>
                            {dish.dish_name ?? dish.name}
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums" style={{ fontSize: 11, color: '#64748B' }}>
                          {dish.total_quantity.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#F1F5F9' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
