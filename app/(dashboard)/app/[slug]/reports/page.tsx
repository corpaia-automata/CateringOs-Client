'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Calendar, TrendingUp, Package, ExternalLink,
  FileSpreadsheet, Loader2, ArrowUpRight, IndianRupee,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(v?: string | number | null) {
  if (v == null || v === '') return '₹0';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:       { bg: '#F1F5F9', color: '#64748B' },
  CONFIRMED:   { bg: '#ECFDF5', color: '#0D9488' },
  IN_PROGRESS: { bg: '#FFF7ED', color: '#F97316' },
  COMPLETED:   { bg: '#F0FDF4', color: '#16A34A' },
  CANCELLED:   { bg: '#FEF2F2', color: '#DC2626' },
};

const PMT_STYLE: Record<string, { bg: string; color: string }> = {
  ADVANCE_PAID: { bg: '#EFF6FF', color: '#3B82F6' },
  PARTIAL:      { bg: '#FFF7ED', color: '#F97316' },
  PENDING:      { bg: '#FEF2F2', color: '#DC2626' },
  FULLY_PAID:   { bg: '#ECFDF5', color: '#0D9488' },
};

function StatusBadge({ value, map }: { value: string; map: Record<string, { bg: string; color: string }> }) {
  const s = map[value] ?? { bg: '#F1F5F9', color: '#64748B' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function KpiMini({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
      <p className="text-xs" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-report'],
    queryFn: () => api.get('/reports/dashboard/'),
  });

  const d = data ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-5 py-4 rounded-xl"
        style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
        <div className="flex items-center gap-3">
          <BarChart3 size={20} style={{ color: '#D95F0E' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Live dashboard is on your home page</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Charts, KPIs, and upcoming events are shown in real-time</p>
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#D95F0E' }}>
          Go to Dashboard <ExternalLink size={13} />
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (<>
          <KpiMini label="Total Events (All Time)" value={String(d.total_events ?? 0)} color="#1C3355" />
          <KpiMini label="Total Revenue" value={fmtINR(d.total_revenue)} color="#16A34A" sub="All time" />
          <KpiMini label="Pending Amount" value={fmtINR(d.pending_payment_amount)} color="#DC2626" />
          <KpiMini label="Avg Revenue / Event" value={fmtINR(d.avg_revenue_per_event)} color="#D95F0E" />
        </>)}
      </div>

      {/* Status breakdown */}
      {!isLoading && d.status_breakdown && (
        <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#0F172A' }}>Events by Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(d.status_breakdown as Record<string, number>).map(([status, count]) => {
              const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', color: '#64748B' };
              return (
                <div key={status} className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
                  style={{ backgroundColor: s.bg, border: `1px solid ${s.color}30` }}>
                  <span className="text-lg font-bold" style={{ color: s.color }}>{count}</span>
                  <span className="text-xs font-medium" style={{ color: s.color }}>{status.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Events Report Tab ────────────────────────────────────────────────────────

function EventsReportTab() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('All');
  const [downloading, setDownloading] = useState(false);

  const qs = new URLSearchParams({
    ...(dateFrom ? { event_date_after: dateFrom } : {}),
    ...(dateTo ? { event_date_before: dateTo } : {}),
    ...(status !== 'All' ? { status } : {}),
    page_size: '200',
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['events-report', qs],
    queryFn: () => api.get(`/reports/events/?${qs}`),
  });

  const events: any[] = data?.results ?? data?.events ?? [];
  const summary = data?.summary ?? {};

  async function handleExport() {
    setDownloading(true);
    try { await api.download(`/reports/events/export/?${qs}`, 'events-report.xlsx'); }
    catch { }
    finally { setDownloading(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-4 rounded-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: dateFrom ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: dateTo ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
            {['All', 'DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s =>
              <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <button onClick={handleExport} disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ml-auto"
          style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}>
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          Export Excel
        </button>
      </div>

      {/* Summary row */}
      {!isLoading && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <KpiMini label="Total Events" value={String(summary.total_events ?? events.length)} color="#1C3355" />
          <KpiMini label="Total Revenue" value={fmtINR(summary.total_revenue)} color="#16A34A" />
          <KpiMini label="Total Pending" value={fmtINR(summary.total_pending)} color="#DC2626" />
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Event Name', 'Client', 'Date', 'Type', 'Guests', 'Total', 'Paid', 'Balance', 'Status', 'Payment'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap" style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : events.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-sm" style={{ color: '#94A3B8' }}>
                  No events in this range
                </td></tr>
              ) : events.map((ev: any) => (
                <tr key={ev.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{ev.event_name || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#64748B' }}>{ev.client_name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#64748B' }}>
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{ev.event_type || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#64748B' }}>{ev.guest_count ?? '—'}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#0F172A' }}>{fmtINR(ev.total_amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#16A34A' }}>{fmtINR(ev.advance_amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#DC2626' }}>{fmtINR(ev.balance_amount)}</td>
                  <td className="px-4 py-3"><StatusBadge value={ev.status} map={STATUS_STYLE} /></td>
                  <td className="px-4 py-3">
                    {ev.payment_status ? <StatusBadge value={ev.payment_status} map={PMT_STYLE} /> : <span style={{ color: '#94A3B8' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals footer */}
            {!isLoading && events.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold" style={{ color: '#0F172A' }}>
                    TOTAL ({events.length} events)
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#0F172A' }}>
                    {events.reduce((s, e) => s + (e.guest_count ?? 0), 0)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: '#0F172A' }}>
                    {fmtINR(events.reduce((s, e) => s + (parseFloat(e.total_amount ?? '0') || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: '#16A34A' }}>
                    {fmtINR(events.reduce((s, e) => s + (parseFloat(e.advance_amount ?? '0') || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: '#DC2626' }}>
                    {fmtINR(events.reduce((s, e) => s + (parseFloat(e.balance_amount ?? '0') || 0), 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────

function RevenueTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-report', year],
    queryFn: () => api.get(`/reports/revenue/?year=${year}`),
  });

  const rows: any[] = data?.results ?? data?.months ?? [];
  const summary = data?.summary ?? {};

  const chartData = rows.map((r: any) => ({
    month: fmtMonth(r.month ?? `${year}-${String(r.month_number ?? 1).padStart(2, '0')}`),
    revenue: parseFloat(r.total_revenue ?? r.revenue ?? '0') || 0,
    paid: parseFloat(r.paid_amount ?? r.paid ?? '0') || 0,
    pending: parseFloat(r.pending_amount ?? r.pending ?? '0') || 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>Year</label>
          <select value={year} onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: '#0F172A', backgroundColor: '#F8FAFC' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />) : (<>
          <KpiMini label="Total Revenue" value={fmtINR(summary.total_revenue)} color="#16A34A" sub={`FY ${year}`} />
          <KpiMini label="Total Paid" value={fmtINR(summary.total_paid)} color="#3B82F6" />
          <KpiMini label="Total Pending" value={fmtINR(summary.total_pending)} color="#DC2626" />
          <KpiMini label="Total Events" value={String(summary.total_events ?? rows.reduce((s: number, r: any) => s + (r.events_count ?? 0), 0))} color="#D95F0E" />
        </>)}
      </div>

      {/* Line Chart */}
      <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
          <TrendingUp size={15} style={{ color: '#D95F0E' }} /> Monthly Revenue — {year}
        </h3>
        {isLoading ? <Skeleton className="h-56 w-full" /> : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#94A3B8' }}>No data for {year}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => {
                const label = String(name ?? '');
                return [fmtINR(v as number | string), label.charAt(0).toUpperCase() + label.slice(1)] as [string, string];
              }}
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#D95F0E" strokeWidth={2.5}
                dot={{ fill: '#D95F0E', r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="paid" name="Paid" stroke="#16A34A" strokeWidth={2}
                dot={{ fill: '#16A34A', r: 3 }} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="pending" name="Pending" stroke="#DC2626" strokeWidth={2}
                dot={{ fill: '#DC2626', r: 3 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Month', 'Events', 'Total Revenue', 'Paid', 'Pending', 'Collection %'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#64748B' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: '#94A3B8' }}>No revenue data</td></tr>
            ) : rows.map((row: any, i: number) => {
              const total = parseFloat(row.total_revenue ?? row.revenue ?? '0') || 0;
              const paid = parseFloat(row.paid_amount ?? row.paid ?? '0') || 0;
              const pending = parseFloat(row.pending_amount ?? row.pending ?? '0') || 0;
              const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td className="px-5 py-3 font-medium" style={{ color: '#0F172A' }}>
                    {fmtMonth(row.month ?? `${year}-${String(row.month_number ?? i + 1).padStart(2, '0')}`)}
                  </td>
                  <td className="px-5 py-3" style={{ color: '#64748B' }}>{row.events_count ?? row.count ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: '#0F172A' }}>{fmtINR(total)}</td>
                  <td className="px-5 py-3" style={{ color: '#16A34A' }}>{fmtINR(paid)}</td>
                  <td className="px-5 py-3" style={{ color: '#DC2626' }}>{fmtINR(pending)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#0D9488' : pct >= 60 ? '#3B82F6' : '#F97316' }} />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: '#64748B' }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ingredient Usage Tab ─────────────────────────────────────────────────────

function IngredientUsageTab() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const qs = new URLSearchParams({ date_after: dateFrom, date_before: dateTo }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['ingredient-usage', qs],
    queryFn: () => api.get(`/reports/ingredient-usage/?${qs}`),
  });

  const ingredients: any[] = data?.results ?? data ?? [];
  const top10 = ingredients.slice(0, 10);

  const maxQty = top10.length > 0 ? Math.max(...top10.map((i: any) => parseFloat(i.total_quantity ?? i.quantity ?? '0') || 0)) : 1;

  const chartData = top10.map((i: any) => ({
    name: i.ingredient_name ?? i.name,
    qty: parseFloat(i.total_quantity ?? i.quantity ?? '0') || 0,
    unit: i.unit ?? i.unit_of_measure,
  }));

  const CATEGORY_COLOR: Record<string, string> = {
    Grocery: '#3B82F6', Vegetable: '#16A34A', Meat: '#E11D48',
    Fruit: '#EA580C', Dairy: '#0891B2', Spice: '#7C3AED', Other: '#64748B',
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-4 rounded-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: dateFrom ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#0F172A' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: '1.5px solid #E2E8F0', color: dateTo ? '#0F172A' : '#94A3B8', backgroundColor: '#F8FAFC' }} />
        </div>
        <button onClick={() => api.download(`/reports/ingredient-usage/export/?${qs}`, 'ingredient-usage.xlsx')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ml-auto"
          style={{ border: '1.5px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}>
          <FileSpreadsheet size={14} /> Export
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col xl:flex-row gap-5">
        {/* Table */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: '#E2E8F0' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Top Ingredient Usage</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['#', 'Ingredient', 'Category', 'Total Qty', 'Unit'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#64748B' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : ingredients.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-14 text-center text-sm" style={{ color: '#94A3B8' }}>
                  No usage data in this range
                </td></tr>
              ) : ingredients.map((ing: any, i: number) => {
                const catColor = CATEGORY_COLOR[ing.category] ?? CATEGORY_COLOR.Other;
                const qty = parseFloat(ing.total_quantity ?? ing.quantity ?? '0') || 0;
                const pct = maxQty > 0 ? Math.round((qty / maxQty) * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: '#0F172A' }}>{ing.ingredient_name ?? ing.name}</div>
                      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9', maxWidth: 120 }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: catColor }} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ing.category ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: catColor + '20', color: catColor }}>
                          {ing.category}
                        </span>
                      ) : <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase" style={{ color: '#64748B' }}>
                      {ing.unit ?? ing.unit_of_measure}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bar Chart */}
        <div className="xl:w-96 rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
            <Package size={14} style={{ color: '#0D9488' }} /> Top 10 by Quantity
          </h3>
          {isLoading ? <Skeleton className="h-64 w-full" /> : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48" style={{ color: '#94A3B8' }}>
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  formatter={(v: any, _: any, props: any) => [`${v} ${props.payload.unit ?? ''}`, 'Qty']}
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="qty" fill="#0D9488" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'events' | 'revenue' | 'usage';

const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'events',    label: 'Events Report', icon: Calendar },
  { key: 'revenue',   label: 'Revenue', icon: IndianRupee },
  { key: 'usage',     label: 'Ingredient Usage', icon: Package },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Insights across events, revenue, and ingredients</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors relative whitespace-nowrap"
            style={{ color: tab === key ? '#D95F0E' : '#64748B' }}>
            <Icon size={14} />
            {label}
            {tab === key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: '#D95F0E' }} />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'events'    && <EventsReportTab />}
      {tab === 'revenue'   && <RevenueTab />}
      {tab === 'usage'     && <IngredientUsageTab />}
    </div>
  );
}
