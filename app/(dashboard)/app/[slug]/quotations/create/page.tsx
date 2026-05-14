'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  IndianRupee,
  Loader2,
  Plus,
  Save,
  Send,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '@/lib/api';
import { parseGuestCount } from '@/lib/utils';
import CreateQuotationLivePreview from '@/components/quotations/CreateQuotationLivePreview';
import { useTenant } from '@/contexts/TenantContext';
import {
  COS_BORDER,
  COS_CANVAS,
  COS_FOREST,
  COS_GOLD,
  COS_GOLD_LIGHT,
} from '@/lib/cosTheme';

import PersonalDetailsForm from './components/PersonalDetailsForm';
import MenuSectionCard from './components/MenuSectionCard';
import type { FormValues, EnquiryPayload } from './types';

const DEFAULT_SECTIONS: FormValues['menuSections'] = [
  { name: 'WELCOME DRINK', items: [] },
  { name: 'STARTER & SOUPS', items: [] },
  { name: 'MAIN COURSE', items: [] },
];

const TEMPLATES = ['Classic', 'Standard', 'Premium'] as const;

function parseNum(v: string | undefined) {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function calcFromMenu(menuSections: FormValues['menuSections']) {
  let sub = 0;
  let itemCount = 0;
  for (const sec of menuSections) {
    for (const it of sec.items) {
      if (!it.dish?.trim()) continue;
      itemCount++;
      sub += parseNum(it.pricePerPlate) * parseNum(it.quantity);
    }
  }
  const service = sub * 0.1;
  const gst = (sub + service) * 0.05;
  const total = sub + service + gst;
  return { sub, service, gst, total, itemCount };
}

function rupee(n: number) {
  return '₹ ' + Math.round(n).toLocaleString('en-IN');
}

export default function CreateQuotationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();
  const { tenantName } = useTenant();
  const previewRef = useRef<HTMLDivElement>(null);
  const [quoteNo] = useState(
    () => `QT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  );
  const [templateVariant, setTemplateVariant] = useState<(typeof TEMPLATES)[number]>('Classic');
  const [quotationTitle, setQuotationTitle] = useState('');
  const [previewFrame, setPreviewFrame] = useState<'desktop' | 'mobile'>('desktop');
  const [openExtras, setOpenExtras] = useState<Record<string, boolean>>({
    menu: true,
    pricing: false,
    terms: false,
    special: false,
    notes: false,
    files: false,
  });

  const [addMenuState, setAddMenuState] = useState<'idle' | 'dropdown' | 'new'>('idle');
  const [newCategoryName, setNewCategoryName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const form = useForm<FormValues>({
    defaultValues: {
      clientName: '',
      contactNumber: '',
      sourceChannel: 'WHATSAPP',
      eventDate: '',
      eventTime: '',
      venue: '',
      guestCount: '',
      eventType: 'WEDDING RECEPTION',
      serviceType: '',
      menuSections: DEFAULT_SECTIONS,
    },
  });

  const {
    handleSubmit,
    control,
    register,
    watch,
    getValues,
    setValue,
    formState: { isSubmitting },
  } = form;

  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
  } = useFieldArray({ control, name: 'menuSections' });

  const guestCount = watch('guestCount');
  const guestCountNum = parseGuestCount(guestCount, 0);
  const currentSections = watch('menuSections');
  const liveValues = watch();

  const { total, itemCount } = useMemo(() => calcFromMenu(currentSections), [currentSections]);
  const advance = total * 0.5;
  const balance = total - advance;

  useEffect(() => {
    const count = parseGuestCount(guestCount, 0);
    if (count < 1) return;
    const sections = getValues('menuSections');
    sections.forEach((section, si) => {
      section.items.forEach((_, ii) => {
        setValue(`menuSections.${si}.items.${ii}.quantity`, String(count), { shouldDirty: true });
      });
    });
  }, [guestCount, getValues, setValue]);

  useEffect(() => {
    if (addMenuState !== 'dropdown') return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAddMenuState('idle');
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [addMenuState]);

  function handleSelectExisting(index: number) {
    setAddMenuState('idle');
    const el = sectionRefs.current[index];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const isDuplicate = currentSections.some(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(`"${name}" already exists`);
      return;
    }
    appendSection({ name, items: [] });
    setNewCategoryName('');
    setAddMenuState('idle');
  }

  function cancelAddCategory() {
    setNewCategoryName('');
    setAddMenuState('idle');
  }

  async function onSubmit(data: FormValues) {
    const payload: EnquiryPayload = {
      customer_name: data.clientName.trim(),
      contact_number: data.contactNumber.trim(),
      source_channel: data.sourceChannel,
      event_type: data.eventType,
      tentative_date: data.eventDate,
      guest_count: data.guestCount.trim() ? parseGuestCount(data.guestCount) : null,
      venue: data.venue.trim(),
    };

    try {
      await api.post('/inquiries/', payload);
      toast.success('Quotation saved — enquiry created');
      router.push(`/app/${slug}/quotations`);
    } catch (err) {
      console.error('[CreateQuotation] Error:', err);
      toast.error('Failed to create quotation. Please try again.');
    }
  }

  function toggleExtra(key: string) {
    setOpenExtras((o) => ({ ...o, [key]: !o[key] }));
  }

  function scrollToPreview() {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const businessName = tenantName?.trim() || 'Your catering brand';

  return (
    <div
      className="font-sans"
      style={{ color: COS_FOREST, margin: '-1rem -1.5rem -1.75rem', minHeight: 'calc(100vh - 72px)' }}
    >
      <div className="px-4 pb-8 pt-2 sm:px-5 lg:px-7">
        {/* Local toolbar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors"
              style={{ borderColor: COS_BORDER, background: '#fff' }}
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#6b7f76' }}>
                New quotation
              </p>
              <h1 className="text-xl font-bold tracking-tight">Create quotation</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors"
              style={{ borderColor: COS_BORDER, background: '#fff', color: COS_FOREST }}
              onClick={() => toast.success('Draft saved locally')}
            >
              <Save size={16} strokeWidth={2} />
              Save draft
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-colors"
              style={{ borderColor: COS_BORDER, background: '#fff', color: COS_FOREST }}
              onClick={scrollToPreview}
            >
              <Eye size={16} strokeWidth={2} />
              Preview
            </button>
            <button
              type="submit"
              form="create-quotation-form"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-md transition-opacity disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${COS_FOREST} 0%, #0d3d2c 100%)`,
                boxShadow: '0 4px 14px rgba(19,78,58,0.35)',
              }}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} strokeWidth={2} />
              )}
              Send quotation
            </button>
          </div>
        </div>

        <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,440px)]">
          {/* LEFT — form column */}
          <div className="flex min-h-0 flex-col gap-5">
            <form id="create-quotation-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
              {/* Quotation details */}
              <div
                className="bg-white p-6 md:p-7"
                style={{
                  border: `1px solid ${COS_BORDER}`,
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(19,78,58,0.06)',
                }}
              >
                <h2 className="mb-4 text-[18px] font-bold">Quotation details</h2>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#6b7f76' }}>
                  Template
                </p>
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {TEMPLATES.map((t) => {
                    const on = templateVariant === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTemplateVariant(t)}
                        className="rounded-xl border-2 px-4 py-4 text-left transition-all"
                        style={{
                          borderColor: on ? COS_GOLD : COS_BORDER,
                          background: on ? `${COS_GOLD_LIGHT}33` : '#fff',
                          boxShadow: on ? `0 0 0 1px ${COS_GOLD}` : 'none',
                        }}
                      >
                        <p className="text-[14px] font-bold">{t}</p>
                        <p className="mt-1 text-[11px]" style={{ color: '#6b7f76' }}>
                          {t === 'Classic' && 'Timeless layout'}
                          {t === 'Standard' && 'Balanced sections'}
                          {t === 'Premium' && 'Rich spreads & gallery'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium" style={{ color: '#3d524a' }}>
                      Quotation title
                    </label>
                    <input
                      value={quotationTitle}
                      onChange={(e) => setQuotationTitle(e.target.value)}
                      placeholder="e.g. Wedding — Anna & Paul"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#134e3a]"
                      style={{ borderColor: COS_BORDER, color: COS_FOREST }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium" style={{ color: '#3d524a' }}>
                      Quotation no.
                    </label>
                    <input
                      readOnly
                      value={quoteNo}
                      className="w-full rounded-xl border px-4 py-3 text-sm tabular-nums"
                      style={{ borderColor: COS_BORDER, background: COS_CANVAS, color: COS_FOREST }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium" style={{ color: '#3d524a' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[#134e3a]"
                      style={{ borderColor: COS_BORDER, color: COS_FOREST }}
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>
              </div>

              <PersonalDetailsForm form={form} />

              {/* Menu accordion */}
              <div
                className="overflow-hidden rounded-xl border bg-white"
                style={{ borderColor: COS_BORDER, boxShadow: '0 1px 3px rgba(19,78,58,0.06)' }}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() => toggleExtra('menu')}
                >
                  <span className="text-[15px] font-bold">Menu &amp; packages</span>
                  <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#6b7f76' }}>
                    {itemCount} items
                    {openExtras.menu ? <ChevronDown className="rotate-180" size={18} /> : <ChevronDown size={18} />}
                  </span>
                </button>
                {openExtras.menu && (
                  <div className="border-t px-4 pb-6 pt-2" style={{ borderColor: COS_BORDER }}>
                    <div className="flex flex-col gap-4 pt-4">
                      {sectionFields.map((field, index) => (
                        <MenuSectionCard
                          key={field.id}
                          ref={(el) => {
                            sectionRefs.current[index] = el;
                          }}
                          control={control}
                          register={register}
                          setValue={setValue}
                          sectionIndex={index}
                          guestCount={guestCountNum}
                          canDelete={sectionFields.length > 1}
                          onRemove={() => removeSection(index)}
                        />
                      ))}
                    </div>

                    <div className="relative mt-4" ref={dropdownRef}>
                      {addMenuState === 'new' ? (
                        <div className="flex flex-wrap gap-2">
                          <input
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCategory();
                              }
                              if (e.key === 'Escape') cancelAddCategory();
                            }}
                            placeholder="e.g. Dessert, Beverages…"
                            className="min-w-[200px] flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[#134e3a]"
                            style={{ borderColor: COS_BORDER, color: COS_FOREST }}
                          />
                          <button
                            type="button"
                            onClick={handleAddCategory}
                            disabled={!newCategoryName.trim()}
                            className="rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                            style={{ background: COS_FOREST }}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={cancelAddCategory}
                            className="rounded-xl border px-4 py-2.5 text-xs font-semibold"
                            style={{ borderColor: COS_BORDER, color: COS_FOREST }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setAddMenuState(addMenuState === 'dropdown' ? 'idle' : 'dropdown')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm transition-colors hover:border-[#134e3a]/50"
                            style={{ borderColor: COS_BORDER, color: '#6b7f76' }}
                          >
                            <Plus size={16} strokeWidth={2} />
                            Add category
                          </button>
                          {addMenuState === 'dropdown' && (
                            <div
                              className="absolute bottom-full z-20 mb-2 w-full overflow-hidden rounded-xl border bg-white shadow-lg"
                              style={{ borderColor: COS_BORDER }}
                            >
                              {currentSections.map((section, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleSelectExisting(index)}
                                  className="w-full cursor-pointer truncate px-4 py-2.5 text-left text-sm hover:bg-[#f4f7f5]"
                                  style={{ color: COS_FOREST }}
                                >
                                  {section.name.trim() || <span className="italic text-neutral-400">Unnamed</span>}
                                </button>
                              ))}
                              <div className="border-t" style={{ borderColor: COS_BORDER }} />
                              <button
                                type="button"
                                onClick={() => setAddMenuState('new')}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-[#f4f7f5]"
                                style={{ color: COS_FOREST }}
                              >
                                <Plus size={14} />
                                Create new category
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible extras */}
              {(
                [
                  { key: 'pricing', label: 'Pricing summary', meta: rupee(total) },
                  { key: 'terms', label: 'Terms & conditions', meta: '9 points' },
                  { key: 'special', label: 'Special information', meta: '5 points' },
                  { key: 'notes', label: 'Notes (optional)', meta: '' },
                  { key: 'files', label: 'Attachments', meta: '3 files' },
                ] as const
              ).map((row) => (
                <div
                  key={row.key}
                  className="overflow-hidden rounded-xl border bg-white"
                  style={{ borderColor: COS_BORDER }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                    onClick={() => toggleExtra(row.key)}
                  >
                    <span className="text-[15px] font-bold">{row.label}</span>
                    <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#6b7f76' }}>
                      {row.meta}
                      {openExtras[row.key] ? (
                        <ChevronDown className="rotate-180" size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </span>
                  </button>
                  {openExtras[row.key] && (
                    <div
                      className="border-t px-6 py-4 text-[13px] leading-relaxed"
                      style={{ borderColor: COS_BORDER, color: '#5c6d66' }}
                    >
                      {row.key === 'pricing' && (
                        <p>Live totals sync with the menu you build. Grand total before tax discounts: {rupee(total)}.</p>
                      )}
                      {row.key === 'terms' && (
                        <p>Standard payment, cancellation, and service clauses will appear on the PDF from your tenant template.</p>
                      )}
                      {row.key === 'special' && (
                        <p>Add dietary notes, décor, or logistics in a future update — placeholders match your design spec.</p>
                      )}
                      {row.key === 'notes' && <p>Optional internal notes for your team.</p>}
                      {row.key === 'files' && <p>Attach PDFs or floor plans — upload support can be wired to storage next.</p>}
                    </div>
                  )}
                </div>
              ))}
            </form>
          </div>

          {/* RIGHT — preview */}
          <div ref={previewRef} className="min-h-[480px] xl:sticky xl:top-4 xl:max-h-[calc(100vh-100px)] xl:self-start">
            <CreateQuotationLivePreview
              values={liveValues}
              templateName={templateVariant}
              quotationTitle={quotationTitle}
              quoteNo={quoteNo}
              previewFrame={previewFrame}
              onPreviewFrameChange={setPreviewFrame}
              businessName={businessName}
            />
          </div>
        </div>

        {/* Bottom — activity + summary */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div
            className="rounded-xl border bg-white p-6"
            style={{ borderColor: COS_BORDER, boxShadow: '0 1px 3px rgba(19,78,58,0.06)' }}
          >
            <h3 className="mb-5 text-[15px] font-bold">Quotation activity</h3>
            <ul className="space-y-0">
              {(
                [
                  { label: 'Created', done: true },
                  { label: 'Menu added', done: itemCount > 0 },
                  { label: 'Sent to client', done: false },
                  { label: 'Client viewed', done: false },
                  { label: 'Accepted', done: false },
                ] as const
              ).map((step, i, arr) => (
                <li key={step.label} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        background: step.done ? COS_GOLD : '#fff',
                        border: step.done ? 'none' : `2px solid ${COS_BORDER}`,
                      }}
                    />
                    {i < arr.length - 1 ? (
                      <div className="w-px flex-1 min-h-[28px]" style={{ background: COS_BORDER }} />
                    ) : null}
                  </div>
                  <div className="pb-6">
                    <p className="text-[13px] font-semibold" style={{ color: step.done ? COS_FOREST : '#9cb0a5' }}>
                      {step.label}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {(
              [
                {
                  label: 'Total amount',
                  value: rupee(total),
                  icon: IndianRupee,
                  iconBg: '#dcfce7',
                  iconColor: COS_FOREST,
                },
                {
                  label: 'Advance (50%)',
                  value: rupee(advance),
                  icon: Wallet,
                  iconBg: '#ffedd5',
                  iconColor: '#c2410c',
                },
                {
                  label: 'Balance',
                  value: rupee(balance),
                  icon: Wallet,
                  iconBg: '#dbeafe',
                  iconColor: '#1d4ed8',
                },
                {
                  label: 'Status',
                  value: 'Draft',
                  icon: Save,
                  iconBg: '#ede9fe',
                  iconColor: '#6d28d9',
                },
              ] as const
            ).map((card) => {
              const Ico = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl border bg-white p-4"
                  style={{ borderColor: COS_BORDER }}
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: card.iconBg }}
                  >
                    <Ico size={20} style={{ color: card.iconColor }} strokeWidth={2} />
                  </div>
                  <p className="text-[11px] font-medium" style={{ color: '#6b7f76' }}>
                    {card.label}
                  </p>
                  <p className="mt-1 text-[15px] font-bold tabular-nums">{card.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
