'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { api, ApiError } from '@/lib/api';

import { MenuItemRow } from './MenuItemRow';
import { ServiceRow } from './ServiceRow';

type EventType = 'Wedding' | 'Reception' | 'Corporate' | 'Birthday' | 'Other';

interface MenuCategoryForm {
  category: string;
  items: {
    name: string;
    quantity: number;
    unit: 'kg' | 'pieces' | 'litres' | 'portions';
    is_complimentary: boolean;
  }[];
}

interface ServiceForm {
  name: string;
  staff_count: number;
  counter_count: number;
  equipment_input: string;
}

interface AddOnForm {
  label: string;
  amount: number;
}

export interface QuotationFormValues {
  event: {
    client_name: string;
    event_type: EventType;
    pax: number;
    venue: string;
    event_date: string;
  };
  menuCategories: MenuCategoryForm[];
  services: ServiceForm[];
  pricing: {
    subtotal: number;
    addOns: AddOnForm[];
  };
}

interface QuotationFormProps {
  slug: string;
  quotationId?: string;
}

interface QuotationApiResponse {
  id: string;
  public_token?: string;
  subtotal?: string;
  total?: string;
  total_amount?: string;
  costing?: Record<string, unknown>;
  costing_data?: Record<string, unknown>;
  event?: {
    client_name?: string;
    event_type?: string;
    pax?: number;
    venue?: string;
    event_date?: string;
  } | null;
  menu_dishes?: Array<{
    name?: string;
    category?: string;
    quantity?: number;
    unit?: 'kg' | 'pieces' | 'litres' | 'portions';
    is_complimentary?: boolean;
  }>;
  menu_services?: Array<{
    name?: string;
    staff_count?: number;
    counter_count?: number;
    equipment_list?: string[];
  }>;
}

const STEPS = ['Event Details', 'Menu Items', 'Services', 'Pricing'] as const;
const AUTO_CALCULATE_SUBTOTAL = false;

const defaultValues: QuotationFormValues = {
  event: {
    client_name: '',
    event_type: 'Wedding',
    pax: 1,
    venue: '',
    event_date: '',
  },
  menuCategories: [
    {
      category: 'Starters',
      items: [{ name: '', quantity: 1, unit: 'portions', is_complimentary: false }],
    },
  ],
  services: [{ name: '', staff_count: 0, counter_count: 0, equipment_input: '' }],
  pricing: {
    subtotal: 0,
    addOns: [{ label: '', amount: 0 }],
  },
};

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

/**
 * Dashboard quotation create/edit form with 4 guided steps.
 */
export function QuotationForm({ slug, quotationId }: QuotationFormProps) {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(Boolean(quotationId));
  const [savedQuote, setSavedQuote] = useState<{ id: string; public_token?: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const {
    register,
    control,
    reset,
    watch,
    setValue,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    defaultValues,
    mode: 'onBlur',
  });

  const categoryArray = useFieldArray({ control, name: 'menuCategories' });
  const serviceArray = useFieldArray({ control, name: 'services' });
  const addOnArray = useFieldArray({ control, name: 'pricing.addOns' });

  useEffect(() => {
    if (!quotationId) return;
    let active = true;
    const load = async () => {
      setIsLoadingExisting(true);
      try {
        const data = (await api.get(`/app/${slug}/quotations/${quotationId}/`)) as QuotationApiResponse;
        if (!active) return;

        const grouped = new Map<string, MenuCategoryForm['items']>();
        (data.menu_dishes ?? []).forEach((dish) => {
          const category = (dish.category || 'General').trim() || 'General';
          if (!grouped.has(category)) grouped.set(category, []);
          grouped.get(category)!.push({
            name: (dish.name || '').trim(),
            quantity: Number(dish.quantity ?? 1) || 1,
            unit: dish.unit || 'portions',
            is_complimentary: Boolean(dish.is_complimentary),
          });
        });
        const menuCategories =
          grouped.size > 0
            ? [...grouped.entries()].map(([category, items]) => ({ category, items }))
            : defaultValues.menuCategories;

        const addOnsRaw = (data.costing ?? data.costing_data ?? {}) as Record<string, unknown>;
        const addOns = Object.entries(addOnsRaw)
          .map(([label, value]) => ({
            label,
            amount: typeof value === 'number' ? value : Number(value ?? 0),
          }))
          .filter((item) => item.label.trim().length > 0);

        const subtotalNum = Number(data.subtotal ?? data.total_amount ?? 0) || 0;
        reset({
          event: {
            client_name: data.event?.client_name || '',
            event_type: ((data.event?.event_type as EventType) || 'Wedding') as EventType,
            pax: Number(data.event?.pax ?? 1) || 1,
            venue: data.event?.venue || '',
            event_date: data.event?.event_date || '',
          },
          menuCategories,
          services:
            (data.menu_services ?? []).length > 0
              ? (data.menu_services ?? []).map((svc) => ({
                  name: svc.name || '',
                  staff_count: Number(svc.staff_count ?? 0),
                  counter_count: Number(svc.counter_count ?? 0),
                  equipment_input: Array.isArray(svc.equipment_list) ? svc.equipment_list.join(', ') : '',
                }))
              : defaultValues.services,
          pricing: {
            subtotal: subtotalNum,
            addOns: addOns.length > 0 ? addOns : defaultValues.pricing.addOns,
          },
        });
        setSavedQuote({ id: data.id, public_token: data.public_token });
      } catch (error) {
        console.error(error);
        toast.error('Failed to load quotation');
      } finally {
        if (active) setIsLoadingExisting(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [quotationId, reset, slug]);

  const watchedAddOns = watch('pricing.addOns');
  const watchedSubtotal = watch('pricing.subtotal');
  const watchedMenuCategories = watch('menuCategories');
  const totalAmount = useMemo(() => {
    const addOnTotal = (watchedAddOns ?? []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    return (Number(watchedSubtotal) || 0) + addOnTotal;
  }, [watchedAddOns, watchedSubtotal]);

  useEffect(() => {
    if (AUTO_CALCULATE_SUBTOTAL) {
      const menuQtyTotal = (watchedMenuCategories ?? []).reduce(
        (catAcc, cat) => catAcc + (cat.items ?? []).reduce((acc, item) => acc + (Number(item.quantity) || 0), 0),
        0,
      );
      setValue('pricing.subtotal', menuQtyTotal);
    }
  }, [setValue, watchedMenuCategories]);

  const validateEventDate = (value: string) => {
    if (!value) return 'Event date is required';
    const selected = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected <= today) return 'Event date must be in the future';
    return true;
  };

  const goNext = async () => {
    if (step === 0) {
      const valid = await trigger(['event.client_name', 'event.event_type', 'event.pax', 'event.venue', 'event.event_date']);
      if (!valid) return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const onSubmit = async (values: QuotationFormValues) => {
    setIsSaving(true);
    setSubmitError(null);
    try {
      const menu_dishes = values.menuCategories.flatMap((group) =>
        (group.items ?? [])
          .filter((item) => item.name.trim())
          .map((item) => ({
            category: group.category.trim() || 'General',
            name: item.name.trim(),
            quantity: Number(item.quantity) || 1,
            unit: item.unit,
            is_complimentary: Boolean(item.is_complimentary),
          })),
      );

      const menu_services = values.services
        .filter((svc) => svc.name.trim())
        .map((svc) => ({
          name: svc.name.trim(),
          staff_count: Number(svc.staff_count) || 0,
          counter_count: Number(svc.counter_count) || 0,
          equipment_list: String(svc.equipment_input || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        }));

      const costing_data = Object.fromEntries(
        (values.pricing.addOns ?? [])
          .filter((row) => row.label.trim())
          .map((row) => [row.label.trim(), Number(row.amount) || 0]),
      );

      const payload = {
        status: 'draft',
        menu_dishes,
        menu_services,
        subtotal: Number(values.pricing.subtotal || 0).toFixed(2),
        total_amount: totalAmount.toFixed(2),
        costing_data,
        pricing_data: {
          event_details: values.event,
        },
      };

      const response = quotationId
        ? ((await api.patch(`/app/${slug}/quotations/${quotationId}/`, payload)) as QuotationApiResponse)
        : ((await api.post(`/app/${slug}/quotations/`, payload)) as QuotationApiResponse);

      setSavedQuote({ id: response.id, public_token: response.public_token });
      toast.success('Quotation saved');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? `Save failed (${error.status})`
          : error instanceof Error
            ? error.message
            : 'Failed to save quotation';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    const targetId = savedQuote?.id || quotationId;
    if (!targetId) return;
    setIsGeneratingPdf(true);
    try {
      await api.post(`/app/${slug}/quotations/${targetId}/generate-pdf/`, {});
      toast.success('PDF generation started');
    } catch (error) {
      console.error(error);
      toast.error('Could not start PDF generation');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{quotationId ? 'Edit Quotation' : 'Create Quotation'}</h1>
        <p className="mt-1 text-sm text-slate-600">Follow 4 steps to prepare and save the quotation.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`rounded-md border px-3 py-2 text-sm ${
              index === step ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>

      {isLoadingExisting ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading quotation...</div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 0 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Step 1: Event Details</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Client name</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('event.client_name', { required: 'Client name is required' })}
                  />
                  {errors.event?.client_name?.message ? (
                    <p className="mt-1 text-xs text-red-600">{errors.event.client_name.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Event type</label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('event.event_type', { required: 'Event type is required' })}
                  >
                    <option value="Wedding">Wedding</option>
                    <option value="Reception">Reception</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Birthday">Birthday</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Pax</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('event.pax', {
                      valueAsNumber: true,
                      required: 'Pax is required',
                      min: { value: 1, message: 'Pax must be greater than 0' },
                    })}
                  />
                  {errors.event?.pax?.message ? <p className="mt-1 text-xs text-red-600">{errors.event.pax.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Venue</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('event.venue', { required: 'Venue is required' })}
                  />
                  {errors.event?.venue?.message ? (
                    <p className="mt-1 text-xs text-red-600">{errors.event.venue.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Event date</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('event.event_date', { validate: validateEventDate })}
                  />
                  {errors.event?.event_date?.message ? (
                    <p className="mt-1 text-xs text-red-600">{errors.event.event_date.message}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Step 2: Menu Items</h2>
              <div className="space-y-5">
                {categoryArray.fields.map((categoryField, categoryIndex) => (
                  <div key={categoryField.id} className="rounded-md border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Category (e.g. Starters)"
                        {...register(`menuCategories.${categoryIndex}.category` as const, {
                          required: 'Category is required',
                        })}
                      />
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (categoryArray.fields.length > 1) categoryArray.remove(categoryIndex);
                        }}
                      >
                        Remove Category
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(watch(`menuCategories.${categoryIndex}.items`) ?? []).map((_, itemIndex) => (
                        <MenuItemRow
                          key={`${categoryField.id}-${itemIndex}`}
                          categoryIndex={categoryIndex}
                          itemIndex={itemIndex}
                          register={register}
                          errors={errors}
                          onRemove={() => {
                            const nextItems = (watch(`menuCategories.${categoryIndex}.items`) ?? []).filter(
                              (_row, idx) => idx !== itemIndex,
                            );
                            setValue(
                              `menuCategories.${categoryIndex}.items`,
                              nextItems.length > 0
                                ? nextItems
                                : [{ name: '', quantity: 1, unit: 'portions', is_complimentary: false }],
                            );
                          }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        const current = watch(`menuCategories.${categoryIndex}.items`) ?? [];
                        setValue(`menuCategories.${categoryIndex}.items`, [
                          ...current,
                          { name: '', quantity: 1, unit: 'portions', is_complimentary: false },
                        ]);
                      }}
                    >
                      Add Row
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() =>
                  categoryArray.append({
                    category: '',
                    items: [{ name: '', quantity: 1, unit: 'portions', is_complimentary: false }],
                  })
                }
              >
                Add Category
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Step 3: Services</h2>
              <div className="space-y-3">
                {serviceArray.fields.map((field, index) => (
                  <ServiceRow
                    key={field.id}
                    index={index}
                    register={register}
                    errors={errors}
                    onRemove={() => {
                      if (serviceArray.fields.length > 1) serviceArray.remove(index);
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => serviceArray.append({ name: '', staff_count: 0, counter_count: 0, equipment_input: '' })}
              >
                Add Service
              </button>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Step 4: Pricing</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Subtotal</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly={AUTO_CALCULATE_SUBTOTAL}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    {...register('pricing.subtotal', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Subtotal cannot be negative' },
                    })}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Add-ons</h3>
                {addOnArray.fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-7">
                      <input
                        type="text"
                        placeholder="Label"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        {...register(`pricing.addOns.${idx}.label` as const)}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        {...register(`pricing.addOns.${idx}.amount` as const, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (addOnArray.fields.length > 1) addOnArray.remove(idx);
                        }}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => addOnArray.append({ label: '', amount: 0 })}
                >
                  Add Add-on
                </button>
              </div>

              <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Total (INR)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatInr(totalAmount)}</p>
              </div>

              {savedQuote?.public_token ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/q/${savedQuote.public_token}`}
                    target="_blank"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Preview Quote
                  </Link>
                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingPdf ? 'Generating PDF...' : 'Generate PDF'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : quotationId ? 'Update Quotation' : 'Save Quotation'}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
