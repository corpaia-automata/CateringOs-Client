'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, ClipboardList, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

import PersonalDetailsForm from './components/PersonalDetailsForm';
import MenuSectionCard     from './components/MenuSectionCard';
import type { FormValues, EnquiryPayload } from './types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: FormValues['menuSections'] = [
  { name: 'Main Course',   items: [] },
  { name: 'Welcome Drink', items: [] },
  { name: 'Other',         items: [] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateEnquiryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router   = useRouter();

  // ── Add-category state machine: idle → dropdown → new ────────────────────
  const [addMenuState,    setAddMenuState]    = useState<'idle' | 'dropdown' | 'new'>('idle');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Refs for scroll-to-existing
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const sectionRefs  = useRef<(HTMLDivElement | null)[]>([]);

  const form = useForm<FormValues>({
    defaultValues: {
      clientName:    '',
      contactNumber: '',
      sourceChannel: '',
      eventDate:     '',
      eventTime:     '',
      venue:         '',
      guestCount:    '',
      eventType:     '',
      serviceType:   '',
      menuSections:  DEFAULT_SECTIONS,
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
    fields:  sectionFields,
    append:  appendSection,
    remove:  removeSection,
  } = useFieldArray({ control, name: 'menuSections' });

  const guestCount      = watch('guestCount');
  const guestCountNum   = parseInt(guestCount) || 0;
  const currentSections = watch('menuSections');   // live names for dropdown

  // ── Auto-sync guestCount → all item quantities ────────────────────────────
  useEffect(() => {
    const count = parseInt(guestCount);
    if (!count || count < 1) return;
    const sections = getValues('menuSections');
    sections.forEach((section, si) => {
      section.items.forEach((_, ii) => {
        setValue(
          `menuSections.${si}.items.${ii}.quantity`,
          String(count),
          { shouldDirty: true }
        );
      });
    });
  // We intentionally only watch guestCount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestCount]);

  // ── Close dropdown on outside click ──────────────────────────────────────
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

  // ── Navigate to existing category ────────────────────────────────────────
  function handleSelectExisting(index: number) {
    setAddMenuState('idle');
    const el = sectionRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Add new category ──────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(data: FormValues) {
    const payload: EnquiryPayload = {
      customer_name:  data.clientName.trim(),
      contact_number: data.contactNumber.trim(),
      source_channel: data.sourceChannel,
      event_type:     data.eventType,
      tentative_date: data.eventDate,
      guest_count:    data.guestCount ? parseInt(data.guestCount) : null,
    };

    try {
      await api.post('/inquiries/', payload);
      toast.success('Enquiry created successfully!');
      router.push(`/app/${slug}/leads`);
    } catch (err) {
      console.error('[CreateEnquiry] Error:', err);
      toast.error('Failed to create enquiry. Please try again.');
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: 'black' }}
          >
            <ClipboardList size={16} style={{ color: 'black' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">New Enquiry</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Fill in client details and build the menu
            </p>
          </div>
        </div>

        {guestCountNum > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {guestCountNum} guests
          </span>
        )}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Form inputs */}
          <PersonalDetailsForm form={form} />

          {/* RIGHT: Menu builder */}
          <div className="rounded-xl border border-slate-300 p-6">

            <h2 className="text-sm font-semibold text-foreground mb-4">Menu Details</h2>

            {/* Category list */}
            <div className="space-y-4">
              {sectionFields.map((field, index) => (
                <MenuSectionCard
                  key={field.id}
                  ref={(el) => { sectionRefs.current[index] = el; }}
                  control={control}
                  register={register}
                  sectionIndex={index}
                  guestCount={guestCountNum}
                  canDelete={sectionFields.length > 1}
                  onRemove={() => removeSection(index)}
                />
              ))}
            </div>

            {/* ── Add Category ─────────────────────────────────────────── */}
            <div className="mt-4 relative" ref={dropdownRef}>

              {addMenuState === 'new' ? (
                /* Input mode — create a new category */
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  { e.preventDefault(); handleAddCategory(); }
                      if (e.key === 'Escape') { cancelAddCategory(); }
                    }}
                    placeholder="e.g. Dessert, Snacks, Tea…"
                    className="h-9 text-sm flex-1 rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="shrink-0"
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={cancelAddCategory}
                    className="shrink-0"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() =>
                      setAddMenuState(addMenuState === 'dropdown' ? 'idle' : 'dropdown')
                    }
                    className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    <Plus size={14} />
                    Add Category
                  </button>

                  {/* Dropdown — opens upward */}
                  {addMenuState === 'dropdown' && (
                    <div className="absolute bottom-full mb-1.5 left-0 right-0 z-20 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">

                      {/* Existing categories */}
                      {currentSections.map((section, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectExisting(index)}
                          className="w-full flex items-center px-3 py-2 text-sm text-foreground hover:bg-muted truncate"
                        >
                          {section.name.trim() || (
                            <span className="text-muted-foreground italic">Unnamed</span>
                          )}
                        </button>
                      ))}

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Create new */}
                      <button
                        type="button"
                        onClick={() => setAddMenuState('new')}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                      >
                        <Plus size={13} />
                        Create New Category
                      </button>

                    </div>
                  )}
                </>
              )}

            </div>

          </div>

        </div>

        {/* ── Bottom Actions ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Creating…</>
              : 'Create Enquiry'
            }
          </Button>
        </div>

      </form>
    </div>
  );
}
