'use client';

/**
 * Dedicated create-event UX (backend field mapping MVP):
 * - Event display title → first line(s) of `notes` prefixed with `Event:` (listing still uses DB `customer_name` = contact name).
 * - End time, optional client email → appended to `notes` (DB has no `event_end_time` / `customer_email` on Event).
 * - Venue name + address → single `venue` string joined with " — ", max 255 chars (validate before submit).
 * - `service_type` is hidden; create always sends BUFFET (required by API).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, eachDayOfInterval, format, isSameDay, startOfDay } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import toast from 'react-hot-toast';

import type { ApiDish, ApiDishCategory } from '@/components/dishes/AddDishInlinePanel';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import { EVENT_TYPES } from '@/lib/constants';
import { parseGuestCount } from '@/lib/utils';

const VENUE_MAX = 255;
/** Quick-pick strip: today through the next N−1 days (always anchored to "today", not the selected week). */
const RIBBON_VISIBLE_DAYS = 5;

const NAVY = '#1a1a2e';
const MENU_BORDER = '#e0e0e0';
const MENU_MUTED = '#f0f0f0';
const MENU_DELETE = '#e53935';

/** First N Master categories (sorted) are added automatically; further categories use Add category. */
const INITIAL_MENU_CATEGORY_COUNT = 3;

function sortCategories(categories: ApiDishCategory[]): ApiDishCategory[] {
  return [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  );
}

/** Dishes linked to a global catalog category (FK on dish). */
function dishesForMenuCategory(dishes: ApiDish[], catalogCategoryId: string | null): ApiDish[] {
  if (!catalogCategoryId) return dishes;
  const cid = String(catalogCategoryId);
  return dishes.filter(d => d.category != null && String(d.category) === cid);
}

function newSectionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function fmtPlateBadge(rate: number, dish: ApiDish | undefined): string {
  if (!dish) return 'Select dish';
  if (dish.dish_type === 'live_counter' && rate <= 0) return 'Price on event';
  const u =
    ({
      PLATE: 'plate',
      KG: 'kg',
      PIECE: 'piece',
      LITRE: 'litre',
      PORTION: 'portion',
    } as const)[dish.serving_unit] ?? 'plate';
  const formatted = rate.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `₹${formatted} / ${u}`;
}

function sectionEmptyHint(name: string): string {
  if (name === 'WELCOME DRINK') return 'No welcome drink added yet.';
  return `No ${name.toLowerCase()} added yet.`;
}

function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function dishRate(d: ApiDish | null | undefined): number {
  if (!d) return 0;
  // Live counters: price is agreed per event (same as AddDishInlinePanel — start at 0).
  if (d.dish_type === 'live_counter') return 0;
  // Prefer selling price; fall back to base_price when API omits or zeroes selling_price.
  return Number(d.selling_price) || Number(d.base_price) || 0;
}

function unitForDish(d: ApiDish): string {
  const m: Record<string, string> = {
    PLATE: 'plates',
    KG: 'kg',
    PIECE: 'pieces',
    LITRE: 'litres',
    PORTION: 'portions',
  };
  return m[d.serving_unit] ?? 'plates';
}

function buildNotes(eventTitle: string, endTime: string, email: string): string {
  const lines: string[] = [];
  const et = eventTitle.trim();
  if (et) lines.push(`Event: ${et}`);
  const etLocal = endTime.trim();
  if (etLocal) lines.push(`End time (planned): ${etLocal}`);
  const em = email.trim();
  if (em) lines.push(`Client email: ${em}`);
  return lines.join('\n');
}

function joinVenue(name: string, addr: string): string {
  const parts = [name.trim(), addr.trim()].filter(Boolean);
  return parts.join(' — ');
}

type MenuRowLocal = { key: string; dishId: string; qty: number; rate: number };
type MenuSectionLocal = {
  id: string;
  name: string;
  /** Global `/categories/` id when this section was seeded or chosen from the catalog. */
  catalogCategoryId: string | null;
  items: MenuRowLocal[];
};

function newMenuRow(guestQty: number): MenuRowLocal {
  const g = Math.max(1, guestQty);
  const key =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { key, dishId: '', qty: g, rate: 0 };
}

export interface CreateEventPageProps {
  /** e.g. /events or /app/my-tenant/events */
  backHref: string;
  detailHref: (eventId: string) => string;
}

export function CreateEventPage({ backHref, detailHref }: CreateEventPageProps) {
  const router = useRouter();

  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [guestCountStr, setGuestCountStr] = useState('100');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('16:00');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [dishes, setDishes] = useState<ApiDish[]>([]);
  const [dishesLoading, setDishesLoading] = useState(true);
  const [categories, setCategories] = useState<ApiDishCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [menuSections, setMenuSections] = useState<MenuSectionLocal[]>([]);
  const [addingCategoryOpen, setAddingCategoryOpen] = useState(false);
  const [addCategoryDraftId, setAddCategoryDraftId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const guestN = parseGuestCount(guestCountStr);

  const dishById = useMemo(() => new Map(dishes.map(d => [String(d.id), d])), [dishes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDishesLoading(true);
      setCategoriesLoading(true);
      try {
        const [rawDishes, rawCats] = await Promise.all([
          api.get('/master/dishes/?page_size=500'),
          api.get('/categories/'),
        ]);
        if (cancelled) return;
        const list: ApiDish[] = Array.isArray(rawDishes) ? rawDishes : (rawDishes.results ?? []);
        setDishes(
          list.filter((item): item is ApiDish => Boolean(item?.id && item.is_active)),
        );
        const catList = Array.isArray(rawCats) ? (rawCats as ApiDishCategory[]) : [];
        setCategories(catList.filter((c): c is ApiDishCategory => Boolean(c?.id && c?.name)));
      } catch {
        if (!cancelled) {
          setDishes([]);
          setCategories([]);
          toast.error('Could not load dishes or categories');
        }
      } finally {
        if (!cancelled) {
          setDishesLoading(false);
          setCategoriesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Pre-list the first few catalog categories (empty dish rows). User adds the rest via Add category. */
  useEffect(() => {
    if (categoriesLoading) return;
    setMenuSections(prev => {
      if (prev.length > 0) return prev;
      const sorted = sortCategories(categories);
      const seed = sorted.slice(0, INITIAL_MENU_CATEGORY_COUNT);
      if (seed.length === 0) return prev;
      return seed.map(c => ({
        id: newSectionId(),
        name: c.name,
        catalogCategoryId: c.id,
        items: [],
      }));
    });
  }, [categoriesLoading, categories]);

  useEffect(() => {
    const g = parseGuestCount(guestCountStr, 0);
    if (g < 1) return;
    setMenuSections(prev =>
      prev.map(sec => ({
        ...sec,
        items: sec.items.map(item => ({ ...item, qty: g })),
      })),
    );
  }, [guestCountStr]);

  const { ribbonDays, todayStart } = useMemo(() => {
    const start = startOfDay(new Date());
    return {
      todayStart: start,
      ribbonDays: eachDayOfInterval({
        start,
        end: addDays(start, RIBBON_VISIBLE_DAYS - 1),
      }),
    };
  }, []);

  const estimated = useMemo(() => {
    let s = 0;
    for (const sec of menuSections) {
      for (const row of sec.items) {
        if (!row.dishId) continue;
        s += row.qty * row.rate;
      }
    }
    return s;
  }, [menuSections]);

  const addSectionItem = useCallback(
    (sectionIndex: number) => {
      setMenuSections(prev => {
        const next = [...prev];
        const sec = next[sectionIndex];
        if (!sec) return prev;
        next[sectionIndex] = {
          ...sec,
          items: [...sec.items, newMenuRow(guestN)],
        };
        return next;
      });
    },
    [guestN],
  );

  const removeSectionRow = useCallback((sectionIndex: number, rowKey: string) => {
    setMenuSections(prev => {
      const next = [...prev];
      const sec = next[sectionIndex];
      if (!sec) return prev;
      next[sectionIndex] = {
        ...sec,
        items: sec.items.filter(r => r.key !== rowKey),
      };
      return next;
    });
  }, []);

  const setSectionRowDish = useCallback(
    (sectionIndex: number, rowKey: string, dishId: string) => {
      const normalized = dishId ? String(dishId) : '';
      const d = normalized ? dishById.get(normalized) : undefined;
      const rate = d ? dishRate(d) : 0;
      setMenuSections(prev => {
        const next = [...prev];
        const sec = next[sectionIndex];
        if (!sec) return prev;
        next[sectionIndex] = {
          ...sec,
          items: sec.items.map(r =>
            r.key === rowKey ? { ...r, dishId: normalized, rate: d ? rate : 0 } : r,
          ),
        };
        return next;
      });
    },
    [dishById],
  );

  const setSectionRowQty = useCallback((sectionIndex: number, rowKey: string, qty: number) => {
    setMenuSections(prev => {
      const next = [...prev];
      const sec = next[sectionIndex];
      if (!sec) return prev;
      next[sectionIndex] = {
        ...sec,
        items: sec.items.map(r => (r.key === rowKey ? { ...r, qty: Math.max(1, qty) } : r)),
      };
      return next;
    });
  }, []);

  const setSectionRowRate = useCallback((sectionIndex: number, rowKey: string, rate: number) => {
    setMenuSections(prev => {
      const next = [...prev];
      const sec = next[sectionIndex];
      if (!sec) return prev;
      next[sectionIndex] = {
        ...sec,
        items: sec.items.map(r => (r.key === rowKey ? { ...r, rate: Math.max(0, rate) } : r)),
      };
      return next;
    });
  }, []);


  const removeCategoryById = useCallback((sectionId: string) => {
    setMenuSections(prev => prev.filter(s => s.id !== sectionId));
  }, []);

  const categoriesAvailableToAdd = useMemo(() => {
    const used = new Set(menuSections.map(s => s.catalogCategoryId).filter(Boolean) as string[]);
    return sortCategories(categories).filter(c => !used.has(c.id));
  }, [categories, menuSections]);

  const submitAddCatalogCategory = useCallback(() => {
    if (!addCategoryDraftId) {
      toast.error('Select a category.');
      return;
    }
    if (menuSections.some(s => s.catalogCategoryId === addCategoryDraftId)) {
      toast.error('That category is already on the menu.');
      return;
    }
    const cat = categories.find(c => c.id === addCategoryDraftId);
    if (!cat) return;
    setMenuSections(prev => [
      ...prev,
      {
        id: newSectionId(),
        name: cat.name,
        catalogCategoryId: cat.id,
        items: [],
      },
    ]);
    setAddCategoryDraftId('');
    setAddingCategoryOpen(false);
    toast.success(`Added "${cat.name}".`);
  }, [addCategoryDraftId, categories, menuSections]);

  async function handleCreate() {
    if (!clientName.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!guestCountStr.trim()) {
      toast.error('Guest count is required');
      return;
    }
    const gc = parseGuestCount(guestCountStr);
    const venue = joinVenue(venueName, venueAddress);
    if (venue.length > VENUE_MAX) {
      toast.error(`Venue (name + address) must be ${VENUE_MAX} characters or less.`);
      return;
    }

    setSubmitting(true);
    try {
      const notes = buildNotes(eventTitle, endTime, email);
      const payload = {
        client_name: clientName.trim(),
        contact_number: phone.trim() || '',
        service_type: 'BUFFET' as const,
        event_type: eventType || '',
        event_date: format(selectedDate, 'yyyy-MM-dd'),
        event_time: startTime || null,
        venue,
        guest_count: gc,
        notes,
      };

      const created = await api.post('/events/', payload);
      const id = String((created as { id?: string }).id ?? '');
      if (!id) {
        toast.error('Event created but response had no id');
        router.push(backHref);
        return;
      }

      const mergedRows: { dish: ApiDish; qty: number; rate: number }[] = [];
      const seen = new Set<string>();
      let skippedDupes = 0;
      for (const sec of menuSections) {
        for (const row of sec.items) {
          if (!row.dishId) continue;
          const dishIdKey = String(row.dishId);
          if (seen.has(dishIdKey)) {
            skippedDupes++;
            continue;
          }
          const dish = dishById.get(dishIdKey);
          if (!dish) continue;
          seen.add(dishIdKey);
          mergedRows.push({ dish, qty: row.qty, rate: row.rate });
        }
      }
      if (skippedDupes > 0) {
        toast('Duplicate dishes were omitted from the saved menu (one row per dish).', {
          icon: 'ℹ️',
        });
      }

      if (mergedRows.length > 0) {
        const dishesPayload = mergedRows.map(line => ({
          dish_id: line.dish.id,
          name: line.dish.name,
          quantity: line.qty,
          qty: line.qty,
          rate: line.rate,
          price_per_unit: line.rate,
          category: String(line.dish.category_name ?? 'Dishes'),
          unit: unitForDish(line.dish),
        }));
        try {
          await api.patch(`/events/${id}/menu/`, { dishes: dishesPayload });
        } catch {
          toast.error('Event saved, but menu could not be applied. Add dishes on the event page.');
        }
      }

      toast.success('Event created');
      router.push(detailHref(id));
    } catch (err: unknown) {
      const e = err as { data?: Record<string, unknown[]> };
      const msg = e?.data ? Object.values(e.data).flat().join(', ') : 'Failed to create event';
      toast.error(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const inputShell =
    'w-full rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-transparent transition focus:ring-2 focus:ring-slate-900/15';

  return (
    <div className="min-h-screen bg-slate-100/80 pb-16">
      <header className="border-b  border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-slate-100"
              aria-label="Back"
            >
              <ArrowLeft size={22} strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                New Event
              </h1>
              <p className="mt-0.5 text-sm text-neutral-500">Create a new catering order</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-5 sm:w-auto sm:justify-end sm:gap-6">
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                Estimated Value
              </p>
              <p className="text-lg font-bold tabular-nums text-neutral-950 sm:text-xl">
                {fmtINR(estimated)}
              </p>
            </div>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void handleCreate()}
              className="h-11 gap-2 rounded-full bg-neutral-500 px-6 text-[15px] font-semibold text-white shadow-none hover:bg-neutral-600 disabled:pointer-events-none disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Create Event
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(30rem,42rem)] lg:items-start">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* Event details */}
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Event Details</h2>
                  <p className="text-sm text-slate-500">When and where is it happening?</p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Event name
                  </label>
                  <input
                    className={inputShell}
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="e.g. Rohith's Wedding Reception"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Event type
                    </label>
                    <select
                      className={inputShell}
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
                    >
                      <option value="">Select type</option>
                      {EVENT_TYPES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Guest count
                    </label>
                    <input
                      type="number"
                      min={1}
                      className={inputShell}
                      value={guestCountStr}
                      onChange={e => setGuestCountStr(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    DATE
                  </label>
                  <div className="flex max-w-full items-center gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                      {ribbonDays.map(d => {
                        const active = isSameDay(d, selectedDate);
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            onClick={() => setSelectedDate(d)}
                            className={[
                              'flex size-[66px] shrink-0 flex-col items-center justify-center rounded-xl border text-center transition-shadow',
                              active
                                ? 'border-neutral-950 bg-neutral-950 text-white shadow-md'
                                : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'text-[10px] font-semibold uppercase leading-none',
                                active ? 'text-white/90' : 'text-slate-500',
                              ].join(' ')}
                            >
                              {format(d, 'EEE').toUpperCase()}
                            </span>
                            <span
                              className={[
                                'mt-1 text-[15px] font-bold tabular-nums leading-none',
                                active ? 'text-white' : 'text-slate-800',
                              ].join(' ')}
                            >
                              {format(d, 'd')}
                            </span>
                          </button>
                        );
                      })}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex size-[66px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-500"
                          aria-label="Open calendar"
                        >
                          <CalendarDays size={18} strokeWidth={1.75} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto overflow-hidden p-0" align="end" alignOffset={0} sideOffset={8}>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={d => {
                            if (d) {
                              setSelectedDate(d);
                              setCalendarOpen(false);
                            }
                          }}
                          defaultMonth={selectedDate}
                          disabled={{ before: todayStart }}
                          classNames={{
                            selected:
                              'rounded-lg border border-neutral-900 bg-neutral-950 font-semibold text-white shadow-sm hover:bg-neutral-950 hover:text-white focus-visible:bg-neutral-950 focus-visible:text-white',
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Clock size={12} aria-hidden /> Start time
                    </label>
                    <input
                      type="time"
                      className={inputShell}
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Clock size={12} aria-hidden /> End time
                    </label>
                    <input
                      type="time"
                      className={inputShell}
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-700">
                    <MapPin size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold">Venue location</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input
                      className={inputShell + ' bg-white'}
                      value={venueName}
                      onChange={e => setVenueName(e.target.value)}
                      placeholder="Venue name (e.g. Grand Palace)"
                    />
                    <textarea
                      className={inputShell + ' min-h-[88px] resize-y bg-white'}
                      value={venueAddress}
                      onChange={e => setVenueAddress(e.target.value)}
                      placeholder="Full address"
                    />
                    <p className="text-xs text-slate-400">
                      Combined field limit {VENUE_MAX} characters ({joinVenue(venueName, venueAddress).length} used).
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Client */}
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Client Information</h2>
                  <p className="text-sm text-slate-500">Who are we serving?</p>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Client name
                  </label>
                  <input
                    className={inputShell}
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Phone
                    </label>
                    <input
                      className={inputShell}
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 00000 00000"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Email <span className="font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      className={inputShell}
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="client@email.com"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Menu */}
          <section className="relative self-start w-full min-w-0 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <UtensilsCrossed size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">Dishes</h2>
                <p className="mt-0.5 text-sm italic text-slate-500">Add your dishes…</p>
              </div>
            </div>

            {categoriesLoading ? (
              <p className="py-12 text-center text-sm text-slate-500">Loading menu categories…</p>
            ) : categories.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No categories found. Add categories under Master first, then refresh this page.
              </p>
            ) : dishesLoading ? (
              <div className="flex flex-col gap-4">
                <p className="text-center text-sm text-slate-500">Loading dishes…</p>
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-3 text-[13px] font-semibold text-slate-400"
                >
                  <Plus size={16} strokeWidth={2.25} aria-hidden />
                  Add category
                </button>
                <ul className="flex list-none flex-col gap-3 p-0">
                  {[0, 1, 2].map(i => (
                    <li
                      key={i}
                      className="animate-pulse rounded-[14px] border border-dashed border-slate-200 bg-slate-50 p-6"
                      aria-hidden
                    >
                      <div className="mx-auto h-8 w-48 rounded bg-slate-200" />
                    </li>
                  ))}
                </ul>
              </div>
            ) : dishes.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No dishes available.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (categoriesAvailableToAdd.length === 0) return;
                    setAddingCategoryOpen(true);
                  }}
                  disabled={categoriesAvailableToAdd.length === 0}
                  className={[
                    'flex w-full items-center justify-center gap-1.5 rounded-full border bg-white py-3 text-[13px] font-semibold outline-none transition-colors',
                    categoriesAvailableToAdd.length === 0
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-neutral-50',
                  ].join(' ')}
                  style={{ borderColor: MENU_BORDER, color: NAVY }}
                >
                  <Plus size={16} strokeWidth={2.25} aria-hidden />
                  {categoriesAvailableToAdd.length === 0
                    ? 'All categories are on the menu'
                    : 'Add category'}
                </button>

                {addingCategoryOpen ? (
                  <div
                    className="rounded-[14px] border border-dashed p-4 md:p-5"
                    style={{ borderColor: MENU_BORDER }}
                  >
                    <p className="mb-3 text-[13px] font-semibold" style={{ color: NAVY }}>
                      Choose a category
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor="create-event-add-category"
                          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Category
                        </label>
                        <div className="relative">
                          <select
                            id="create-event-add-category"
                            value={addCategoryDraftId}
                            onChange={e => setAddCategoryDraftId(e.target.value)}
                            className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm outline-none focus:border-slate-400"
                            style={{ color: NAVY }}
                          >
                            <option value="">Select category…</option>
                            {categoriesAvailableToAdd.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                            aria-hidden
                          />
                        </div>
                        {categoriesAvailableToAdd.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500">
                            All Master categories are already on this menu.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          size="lg"
                          className="h-10 rounded-full px-5"
                          disabled={!addCategoryDraftId || categoriesAvailableToAdd.length === 0}
                          onClick={() => submitAddCatalogCategory()}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="h-10 rounded-full px-5"
                          onClick={() => {
                            setAddingCategoryOpen(false);
                            setAddCategoryDraftId('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <ul className="flex list-none flex-col gap-3 p-0">
                  {menuSections.map((section, sectionIndex) => {
                    const sectionDishes = dishesForMenuCategory(dishes, section.catalogCategoryId);
                    return (
                      <li key={section.id}>
                        <div
                          className="bg-white p-4 md:p-5"
                          style={{ border: `1px solid ${MENU_BORDER}`, borderRadius: '14px' }}
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <p
                              className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-wide"
                              style={{ color: NAVY }}
                            >
                              {section.name}
                            </p>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => addSectionItem(sectionIndex)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 py-2 text-[12px] font-semibold outline-none transition-colors hover:bg-neutral-50"
                                style={{ borderColor: MENU_BORDER, color: NAVY }}
                              >
                                <Plus size={14} strokeWidth={2.25} aria-hidden />
                                Add item
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCategoryById(section.id)}
                                title="Remove this category from the menu"
                                className="flex cursor-pointer items-center justify-center rounded-full border bg-white p-2 outline-none transition-colors hover:bg-neutral-50"
                                style={{ borderColor: MENU_BORDER, color: MENU_DELETE }}
                                aria-label="Remove this category from the menu"
                              >
                                <Trash2 size={16} strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          </div>

                          <div
                            className="flex flex-col gap-3 bg-white p-4 md:p-5"
                            style={{
                              border: `1px solid ${MENU_BORDER}`,
                              borderRadius: '14px',
                              borderStyle: section.items.length === 0 ? 'dashed' : 'solid',
                            }}
                          >
                            {section.items.length === 0 ? (
                              <div className="flex flex-col items-center gap-4 py-6 text-center">
                                <p className="max-w-sm text-[13px] text-neutral-400">
                                  {sectionEmptyHint(section.name)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => addSectionItem(sectionIndex)}
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-4 py-2.5 text-[12px] font-semibold outline-none transition-colors hover:bg-neutral-50"
                                  style={{ borderColor: MENU_BORDER, color: NAVY }}
                                >
                                  <Plus size={14} strokeWidth={2.25} aria-hidden />
                                  Add dish
                                </button>
                              </div>
                            ) : (
                              <>
                                {section.items.map(row => {
                                  const rowId = row.dishId ? String(row.dishId) : '';
                                  const dish = rowId ? dishById.get(rowId) : undefined;
                                  const isLive = dish?.dish_type === 'live_counter';
                                  const baseList =
                                    sectionDishes.length > 0 ? sectionDishes : dishes;
                                  const options =
                                    dish && !baseList.some(d => String(d.id) === rowId)
                                      ? [...baseList, dish]
                                      : baseList;
                                  return (
                                    <div
                                      key={row.key}
                                      className="flex min-h-[46px] flex-wrap items-center gap-3"
                                    >
                                      <div className="relative min-w-0 flex-1 basis-[min(100%,12rem)]">
                                        <select
                                          value={rowId}
                                          onChange={e =>
                                            setSectionRowDish(
                                              sectionIndex,
                                              row.key,
                                              e.target.value,
                                            )
                                          }
                                          className="w-full max-w-full cursor-pointer appearance-none truncate rounded-[9999px] border bg-white py-2.5 pl-4 pr-10 text-left text-[13px] leading-snug outline-none transition-colors focus:border-[#1a1a2e]"
                                          style={{ borderColor: MENU_BORDER, color: NAVY }}
                                        >
                                          <option value="">Select dish</option>
                                          {options.map(opt => (
                                            <option key={opt.id} value={String(opt.id)}>
                                              {opt.name}
                                            </option>
                                          ))}
                                        </select>
                                        <ChevronDown
                                          size={16}
                                          strokeWidth={2}
                                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 opacity-70"
                                          style={{ color: NAVY }}
                                          aria-hidden
                                        />
                                      </div>

                                      {isLive ? (
                                        <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
                                          Rate ₹
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            title="Rate for live counter"
                                            value={row.rate}
                                            onChange={e =>
                                              setSectionRowRate(
                                                sectionIndex,
                                                row.key,
                                                Math.max(0, Number(e.target.value) || 0),
                                              )
                                            }
                                            className="box-border h-9 w-[4.5rem] rounded-lg border-0 px-2 py-2 text-center text-[13px] font-medium tabular-nums outline-none"
                                            style={{ backgroundColor: MENU_MUTED, color: NAVY }}
                                          />
                                        </label>
                                      ) : (
                                        <span
                                          className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[9999px] px-3 py-2 text-[12px] font-medium tabular-nums leading-none"
                                          style={{ backgroundColor: MENU_MUTED, color: NAVY }}
                                        >
                                          {fmtPlateBadge(row.rate, dish)}
                                        </span>
                                      )}

                                      <input
                                        type="number"
                                        min={1}
                                        title="Quantity"
                                        value={row.qty}
                                        onChange={e =>
                                          setSectionRowQty(
                                            sectionIndex,
                                            row.key,
                                            parseGuestCount(e.target.value, 1),
                                          )
                                        }
                                        className="box-border h-9 w-[52px] shrink-0 cursor-pointer rounded-lg border-0 px-1 py-2 text-center text-[13px] font-medium tabular-nums outline-none"
                                        style={{ backgroundColor: MENU_MUTED, color: NAVY }}
                                      />

                                      <button
                                        type="button"
                                        onClick={() => removeSectionRow(sectionIndex, row.key)}
                                        title="Remove item"
                                        className="flex shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-1.5 outline-none transition-opacity hover:opacity-80"
                                        style={{ color: MENU_DELETE }}
                                        aria-label="Remove dish row"
                                      >
                                        <Trash2 size={18} strokeWidth={2} aria-hidden />
                                      </button>
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => addSectionItem(sectionIndex)}
                                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-[12px] font-semibold outline-none transition-colors hover:bg-neutral-50"
                                  style={{ borderColor: MENU_BORDER, color: NAVY }}
                                >
                                  <Plus size={14} strokeWidth={2.25} aria-hidden />
                                  Add another dish
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
