'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Users, Calendar, IndianRupee, Clock,
  TrendingUp, TrendingDown, UtensilsCrossed, ChevronDown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
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

const DISHES_PLACEHOLDER = [
  { dish_name: 'Chicken Biryani', total_quantity: 124, total_revenue: 45000 },
  { dish_name: 'Mutton Rogan Josh', total_quantity: 89, total_revenue: 67000 },
  { dish_name: 'Paneer Butter Masala', total_quantity: 76, total_revenue: 22000 },
  { dish_name: 'Veg Pulao', total_quantity: 65, total_revenue: 15000 },
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

export default function DashboardPage() {
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
    queryKey: ['upcoming-events'],
    queryFn: () => api.get('/events/?upcoming=true&filter=next7'),
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

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className='px-3'>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight"> Your Dashboard</h1>
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

      {/* ── Row 1: Upcoming Events (60%) + Top Dishes (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Upcoming Events */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <h2 className="font-bold" style={{ fontSize: 15, color: '#0F172A' }}>
              Upcoming Events
            </h2>
            <Link
              href="/events"
              className="font-semibold transition-colors hover:opacity-70"
              style={{ fontSize: 13, color: '#10B981' }}
            >
              View All
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            {upcomingLoading ? (
              <div className="p-6 flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : upcomingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
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
                  <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                    {['Event', 'Date', 'Guests', 'Status'].map(h => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left font-semibold uppercase tracking-wide"
                        style={{ fontSize: 10, color: '#10B981', letterSpacing: '0.07em' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingList.slice(0, 3).map((event: any) => (
                    <tr
                      key={event.id}
                      onClick={() => { window.location.href = `/events/${event.id}`; }}
                      className="group cursor-pointer transition-colors duration-150"
                      style={{ borderBottom: '1px solid #F8FAFC' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Event + venue */}
                      <td className="px-5 py-4">
                        <span className="font-bold block" style={{ fontSize: 13, color: '#0F172A' }}>
                          {event.event_name || event.name || '—'}
                        </span>
                        {event.venue && (
                          <span className="block mt-0.5" style={{ fontSize: 11, color: '#94A3B8' }}>
                            {event.venue}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap" style={{ fontSize: 12, color: '#64748B' }}>
                        {event.event_date ? fmtDate(event.event_date) : '—'}
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
        </Card>

        {/* Top Dishes */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <h2 className="font-bold" style={{ fontSize: 15, color: '#0F172A' }}>
              Top Dishes
            </h2>
            <Link
              href="/master"
              className="font-semibold transition-colors hover:opacity-70"
              style={{ fontSize: 13, color: '#10B981' }}
            >
              View Menu
            </Link>
          </div>

          {/* Dishes list */}
          <div className="flex flex-col px-6 py-4 gap-4 flex-1">
            {dishesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))
            ) : dishes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <UtensilsCrossed size={28} style={{ color: '#CBD5E1' }} className="mb-2" />
                <p style={{ fontSize: 12, color: '#94A3B8' }}>No dish data available</p>
              </div>
            ) : (
              dishes.slice(0, 6).map((dish: any, i: number) => {
                const revenue = dish.total_revenue ?? dish.total_quantity ?? 0;
                const orders = dish.orders_count ?? dish.total_quantity ?? 0;
                const growth = dish.growth ?? 5;
                return (
                  <div key={i} className="flex items-center gap-3">
                    {/* Rank circle */}
                    <div
                      className="flex items-center justify-center rounded-full shrink-0 font-bold"
                      style={{
                        width: 28,
                        height: 28,
                        background: 'rgba(16,185,129,0.12)',
                        color: '#10B981',
                        fontSize: 12,
                      }}
                    >
                      {i + 1}
                    </div>
                    {/* Name + orders */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ fontSize: 13, color: '#0F172A' }}>
                        {dish.dish_name ?? dish.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                        {orders.toLocaleString()} orders this month
                        {isDishesSample && <span style={{ color: '#CBD5E1' }}> · Sample</span>}
                      </p>
                    </div>
                    {/* Revenue + growth */}
                    <div className="text-right shrink-0">
                      <p className="font-bold" style={{ fontSize: 13, color: '#0F172A' }}>
                        {formatINR(revenue)}
                      </p>
                      <p className="font-semibold" style={{ fontSize: 11, color: '#10B981', marginTop: 1 }}>
                        +{growth}%
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* ── Row 2: Revenue Trend (60%) + Events Per Day (40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Revenue Trend */}
        <Card className="lg:col-span-3 p-6">
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

        {/* Events Per Day */}
        <Card className="lg:col-span-2 p-6">
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={eventsByDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={22}>
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
  );
}
