'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { EVENT_TYPES, SERVICE_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';

import CategoryAccordion from './CategoryAccordion';
import { preEstimateApi } from './api';
import { DraftCategory, DraftItem, PreEstimate } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcTotal(qty: string, rate: string): string {
  const q = parseFloat(qty) || 0;
  const r = parseFloat(rate) || 0;
  return (q * r).toFixed(2);
}

function calcTotalsFromDraft(categories: DraftCategory[], margin: number) {
  const totalCost = categories.reduce(
    (sum, cat) =>
      sum + cat.items.reduce((s, item) => s + (parseFloat(item.total) || 0), 0),
    0
  );
  const m = margin / 100;
  const totalQuote = m < 1 ? totalCost / (1 - m) : 0;
  const totalProfit = totalQuote - totalCost;
  return { totalCost, totalQuote, totalProfit };
}

function formatINR(value: number) {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newDraftItem(): DraftItem {
  return {
    _key: crypto.randomUUID(),
    id: null,
    name: '',
    unit: 'Nos',
    quantity: '',
    rate: '',
    total: '0.00',
  };
}

function serverToDraft(pe: PreEstimate): DraftCategory[] {
  return pe.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    order: cat.order,
    items: cat.items.map((item) => ({
      _key: crypto.randomUUID(),
      id: item.id,
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      rate: item.rate,
      total: item.total,
    })),
  }));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PreEstimatePage() {
  const { id: inquiryId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Form state (top section) ───────────────────────────────────────────────
  const [eventType, setEventType]     = useState('');
  const [serviceType, setServiceType] = useState('');
  const [location, setLocation]       = useState('');
  const [guestCount, setGuestCount]   = useState('');
  const [margin, setMargin]           = useState(30);

  // ── PreEstimate state ──────────────────────────────────────────────────────
  const [preEstimateId, setPreEstimateId] = useState<string | null>(null);
  const [categories, setCategories]       = useState<DraftCategory[]>([]);
  const [recalculating, setRecalculating] = useState(false);
  const [creating, setCreating]           = useState(false);

  // ── Load existing PreEstimate for this inquiry (first one) ─────────────────
  const { data: existing, isLoading } = useQuery<PreEstimate | null>({
    queryKey: ['pre-estimate', inquiryId],
    queryFn: async () => {
      try {
        // The backend has no list endpoint yet — we store the id in sessionStorage
        // as a lightweight approach until a list endpoint is added.
        const stored = sessionStorage.getItem(`pe_${inquiryId}`);
        if (!stored) return null;
        return await preEstimateApi.get(stored);
      } catch {
        return null;
      }
    },
    enabled: !!inquiryId,
  });

  useEffect(() => {
    if (!existing) return;
    setPreEstimateId(existing.id);
    setEventType(existing.event_type);
    setServiceType(existing.service_type);
    setLocation(existing.location);
    setGuestCount(String(existing.guest_count));
    setMargin(parseFloat(existing.target_margin));
    setCategories(serverToDraft(existing));
  }, [existing]);

  // ── Derived totals (live, no round-trip needed) ────────────────────────────
  const { totalCost, totalQuote, totalProfit } = calcTotalsFromDraft(categories, margin);
  const guests = parseInt(guestCount) || 1;

  // ── Create PreEstimate ─────────────────────────────────────────────────────
  async function handleCreate() {
    if (!eventType || !serviceType || !location || !guestCount) {
      toast.error('Fill in all event details first.');
      return;
    }
    setCreating(true);
    try {
      const pe = await preEstimateApi.create({
        inquiry: inquiryId,
        event_type: eventType,
        service_type: serviceType,
        location,
        guest_count: parseInt(guestCount),
        target_margin: margin,
      });
      setPreEstimateId(pe.id);
      sessionStorage.setItem(`pe_${inquiryId}`, pe.id);
      setCategories(serverToDraft(pe));
      toast.success('Pre-estimate created.');
    } catch {
      toast.error('Failed to create pre-estimate.');
    } finally {
      setCreating(false);
    }
  }

  // ── Item management ────────────────────────────────────────────────────────
  const addRow = useCallback((categoryId: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: [...cat.items, newDraftItem()] }
          : cat
      )
    );
  }, []);

  const updateItem = useCallback(
    (categoryId: string, key: string, field: keyof DraftItem, value: string) => {
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id !== categoryId) return cat;
          return {
            ...cat,
            items: cat.items.map((item) => {
              if (item._key !== key) return item;
              const updated = { ...item, [field]: value };
              // Recompute total whenever qty or rate changes
              if (field === 'quantity' || field === 'rate') {
                updated.total = calcTotal(
                  field === 'quantity' ? value : item.quantity,
                  field === 'rate' ? value : item.rate
                );
              }
              return updated;
            }),
          };
        })
      );
    },
    []
  );

  const removeItem = useCallback((categoryId: string, key: string) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter((i) => i._key !== key) }
          : cat
      )
    );
  }, []);

  // Save a single item row to backend (called on blur if item already exists,
  // or when a new row has enough data to persist)
  const saveItem = useCallback(
    async (categoryId: string, key: string) => {
      if (!preEstimateId) return;
      const cat = categories.find((c) => c.id === categoryId);
      const item = cat?.items.find((i) => i._key === key);
      if (!item || !item.name || !item.quantity || !item.rate) return;
      try {
        const saved = await preEstimateApi.addItem(preEstimateId, {
          category_id: categoryId,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
        });
        // Stamp the returned id onto the draft item
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id !== categoryId
              ? cat
              : {
                  ...cat,
                  items: cat.items.map((i) =>
                    i._key === key ? { ...i, id: saved.id, total: saved.total } : i
                  ),
                }
          )
        );
      } catch {
        toast.error('Failed to save item.');
      }
    },
    [preEstimateId, categories]
  );

  // ── Recalculate (persists totals to backend) ───────────────────────────────
  async function handleRecalculate() {
    if (!preEstimateId) return;
    setRecalculating(true);
    try {
      const updated = await preEstimateApi.recalculate(preEstimateId);
      queryClient.setQueryData(['pre-estimate', inquiryId], updated);
      toast.success('Totals updated.');
    } catch {
      toast.error('Recalculation failed.');
    } finally {
      setRecalculating(false);
    }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!preEstimateId) return;
    try {
      const data = await preEstimateApi.export(preEstimateId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `pre-estimate-${preEstimateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed.');
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-semibold">Pre-Estimate</h1>
        </div>
        <div className="flex gap-2">
          {preEstimateId && (
            <>
              <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                {recalculating ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                Recalculate
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download size={14} className="mr-1" /> Export
              </Button>
            </>
          )}
          {!preEstimateId && (
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 size={14} className="animate-spin mr-1" />}
              Create Pre-Estimate
            </Button>
          )}
        </div>
      </div>

      {/* Event Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Event Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              disabled={!!preEstimateId}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="">Select…</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Service Type</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              disabled={!!preEstimateId}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="">Select…</option>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Location</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!!preEstimateId}
              placeholder="e.g. Banquet Hall A"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Guest Count</label>
            <Input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              disabled={!!preEstimateId}
              placeholder="e.g. 200"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2 col-span-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <label>Target Margin</label>
              <span className="font-medium text-foreground">{margin}%</span>
            </div>
            <Slider
              value={[margin]}
              onValueChange={(v) => setMargin(Array.isArray(v) ? v[0] : v)}
              min={1}
              max={60}
              step={1}
              disabled={!!preEstimateId}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {preEstimateId && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Cost',       value: formatINR(totalCost) },
            { label: 'Cost / Pax',       value: formatINR(totalCost / guests) },
            { label: 'Quote',            value: formatINR(totalQuote) },
            { label: 'Quote / Pax',      value: formatINR(totalQuote / guests) },
            { label: 'Profit',           value: formatINR(totalProfit) },
          ].map(({ label, value }) => (
            <Card key={label} className="text-center">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-base font-semibold">₹{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Categories */}
      {preEstimateId && categories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Cost Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion multiple className="w-full">
              {[...categories]
                .sort((a, b) => a.order - b.order)
                .map((cat) => (
                  <CategoryAccordion
                    key={cat.id}
                    category={cat}
                    onAddRow={addRow}
                    onUpdateItem={updateItem}
                    onRemoveItem={removeItem}
                    onSaveItem={saveItem}
                  />
                ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
