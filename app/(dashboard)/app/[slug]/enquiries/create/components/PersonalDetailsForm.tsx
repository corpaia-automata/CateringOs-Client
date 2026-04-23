'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { EVENT_TYPES } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormValues } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_CHANNEL_OPTIONS = [
  { label: 'Phone Call', value: 'PHONE_CALL' },
  { label: 'WhatsApp',   value: 'WHATSAPP'   },
  { label: 'Walk-In',    value: 'WALK_IN'    },
] as const;

const SERVICE_TYPE_OPTIONS = [
  { label: 'Buffet',        value: 'BUFFET'        },
  { label: 'Box Counter',   value: 'BOX_COUNTER'   },
  { label: 'Table Service', value: 'TABLE_SERVICE' },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  form: UseFormReturn<FormValues>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PersonalDetailsForm({ form }: Props) {
  const { register, control, formState: { errors } } = form;

  return (
    <div className="rounded-xl border border-slate-200 p-6 space-y-6">

      {/* ── 1. PERSONAL DETAILS ─────────────────────────────────────────── */}
      <div>
        <SectionLabel>Personal Details</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="space-y-1.5">
            <Label htmlFor="clientName">
              Client Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              placeholder="e.g. Ahmed Khan"
              aria-invalid={!!errors.clientName}
              className={cn(errors.clientName && 'border-destructive')}
              {...register('clientName', { required: 'Client name is required' })}
            />
            <FieldError message={errors.clientName?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactNumber">Contact Number</Label>
            <Input
              id="contactNumber"
              placeholder="+91 9999 999 999"
              className="h-9 text-sm"
              {...register('contactNumber')}
            />
          </div>

        </div>

        {/* Source Channel chips */}
        <div className="mt-5">
          <SectionLabel>
            Source Channel{' '}
            <span className="text-destructive normal-case font-normal tracking-normal">*</span>
          </SectionLabel>
          <Controller
            control={control}
            name="sourceChannel"
            rules={{ required: 'Please select a source channel' }}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {SOURCE_CHANNEL_OPTIONS.map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(selected ? '' : opt.value)}
                      className={cn(
                        'px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
          <FieldError message={errors.sourceChannel?.message} />
        </div>

      </div>

      <hr className="border-border" />

      {/* ── 2. EVENT DETAILS ────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Event Details</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="space-y-1.5">
            <Label htmlFor="eventDate">
              Event Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="eventDate"
              type="date"
              className="h-9 text-sm"
              aria-invalid={!!errors.eventDate}
              {...register('eventDate', { required: 'Event date is required' })}
            />
            <FieldError message={errors.eventDate?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eventTime">Event Time</Label>
            <Input id="eventTime" type="time" className="h-9 text-sm" {...register('eventTime')} />
          </div>

          <div className="space-y-1.5 col-span-full">
            <Label htmlFor="venue">Venue</Label>
            <Input
              id="venue"
              placeholder="e.g. Grand Banquet Hall, Taj Hotel"
              className="h-9 text-sm"
              {...register('venue')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guestCount">Guest Count</Label>
            <Input
              id="guestCount"
              type="number"
              min="1"
              placeholder="e.g. 200"
              className="h-9 text-sm"
              {...register('guestCount')}
            />
          </div>

        </div>

        {/* Event Type chips */}
        <div className="mt-5">
          <SectionLabel>
            Event Type{' '}
            <span className="text-destructive normal-case font-normal tracking-normal">*</span>
          </SectionLabel>
          <Controller
            control={control}
            name="eventType"
            rules={{ required: 'Please select an event type' }}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {(EVENT_TYPES as readonly string[]).map((type) => {
                  const selected = field.value === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(selected ? '' : type)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            )}
          />
          <FieldError message={errors.eventType?.message} />
        </div>
      </div>

      <hr className="border-border" />

      {/* ── 3. SERVICE TYPE ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel>
          Service Type{' '}
          <span className="text-destructive normal-case font-normal tracking-normal">*</span>
        </SectionLabel>
        <Controller
          control={control}
          name="serviceType"
          rules={{ required: 'Please select a service type' }}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPE_OPTIONS.map((opt) => {
                const selected = field.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(selected ? '' : opt.value)}
                    className={cn(
                      'px-5 py-2 rounded-full text-sm font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        />
        <FieldError message={errors.serviceType?.message} />
      </div>

    </div>
  );
}
