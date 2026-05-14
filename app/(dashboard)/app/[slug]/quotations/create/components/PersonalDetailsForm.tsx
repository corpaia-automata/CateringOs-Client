'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormValues } from '../types';

import { COS_BORDER, COS_FOREST } from '@/lib/cosTheme';

const RED = '#e53935';

/** Lead form event labels (uppercase UI); stored values match display for API text field */
const CREATE_LEAD_EVENT_TYPES = [
  'WEDDING RECEPTION',
  'NIKKAH',
  'SALKARAM',
  'FAMILY MEET',
  'MEETING',
  'ENGAGEMENT',
  'CORPORATE EVENT',
  'GET-TOGETHER',
  'BIRTHDAY PARTY',
  'CONFERENCE',
  'OTHER',
] as const;

const SERVICE_TYPE_OPTIONS = [
  { label: 'BUFFET', value: 'BUFFET' },
  { label: 'BOX COUNTER', value: 'BOX_COUNTER' },
  { label: 'TABLE SERVICE', value: 'TABLE_SERVICE' },
] as const;

const pillInput =
  'w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#1a2e28] outline-none transition-colors placeholder:text-neutral-400 focus:border-[#134e3a] cursor-pointer';

interface Props {
  form: UseFormReturn<FormValues>;
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] text-neutral-600 cursor-pointer"
    >
      {children}
      {required ? <span style={{ color: RED }}> *</span> : null}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs" style={{ color: RED }}>{message}</p>;
}

export default function PersonalDetailsForm({ form }: Props) {
  const { register, control, formState: { errors } } = form;

  return (
    <>
      <div
        className="bg-white p-6 font-sans md:p-7"
        style={{
          border: `1px solid ${COS_BORDER}`,
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(19,78,58,0.06)',
        }}
      >
        <h2 className="mb-5 text-[18px] font-bold" style={{ color: COS_FOREST }}>
          Client details
        </h2>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="clientName" required>
              Client name
            </FieldLabel>
            <input
              id="clientName"
              placeholder="e.g. John Mathew"
              aria-invalid={!!errors.clientName}
              className={cn(pillInput, errors.clientName && 'border-[#e53935]')}
              style={{ borderColor: errors.clientName ? RED : COS_BORDER }}
              {...register('clientName', { required: 'Client name is required' })}
            />
            <FieldError message={errors.clientName?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="contactNumber">Phone</FieldLabel>
            <input
              id="contactNumber"
              placeholder="+91 9999 999 999"
              className={pillInput}
              style={{ borderColor: COS_BORDER }}
              {...register('contactNumber')}
            />
          </div>
        </div>
      </div>

      <div
        className="bg-white p-6 font-sans md:p-7"
        style={{
          border: `1px solid ${COS_BORDER}`,
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(19,78,58,0.06)',
        }}
      >
        <h2 className="mb-5 text-[18px] font-bold" style={{ color: COS_FOREST }}>
          Event details
        </h2>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="eventDate" required>
              Event date
            </FieldLabel>
            <div className="relative">
              <input
                id="eventDate"
                type="date"
                aria-invalid={!!errors.eventDate}
                className={cn(
                  pillInput,
                  'pr-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
                )}
                style={{ borderColor: errors.eventDate ? RED : COS_BORDER }}
                {...register('eventDate', { required: 'Event date is required' })}
              />
              <Calendar
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: COS_FOREST }}
                aria-hidden
              />
            </div>
            <FieldError message={errors.eventDate?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="eventTime">Time</FieldLabel>
            <div className="relative">
              <input
                id="eventTime"
                type="time"
                className={cn(
                  pillInput,
                  'pr-11 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
                )}
                style={{ borderColor: COS_BORDER }}
                {...register('eventTime')}
              />
              <Clock
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: COS_FOREST }}
                aria-hidden
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="venue">Venue</FieldLabel>
            <input
              id="venue"
              placeholder="e.g. Grand Palace, Kochi"
              className={pillInput}
              style={{ borderColor: COS_BORDER }}
              {...register('venue')}
            />
          </div>

          <div>
            <FieldLabel htmlFor="guestCount">Guests</FieldLabel>
            <input
              id="guestCount"
              type="number"
              min={1}
              placeholder="e.g. 250"
              className={pillInput}
              style={{ borderColor: COS_BORDER }}
              {...register('guestCount')}
            />
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: COS_FOREST }}>
            Event type{' '}
            <span className="font-bold normal-case" style={{ color: RED }}>
              *
            </span>
          </p>
          <Controller
            control={control}
            name="eventType"
            rules={{ required: 'Please select an event type' }}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2" style={{ gap: '8px' }}>
                {CREATE_LEAD_EVENT_TYPES.map((type) => {
                  const selected = field.value === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(selected ? '' : type)}
                      className={cn(
                        'cursor-pointer rounded-full border px-3 py-2 text-[12px] font-bold uppercase tracking-wide outline-none transition-colors',
                        selected ? 'border-transparent text-white' : 'bg-white',
                      )}
                      style={
                        selected
                          ? { backgroundColor: COS_FOREST }
                          : { borderColor: COS_FOREST, color: COS_FOREST }
                      }
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

        <div className="mt-8">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-wide" style={{ color: COS_FOREST }}>
            Service type
          </p>
          <Controller
            control={control}
            name="serviceType"
            rules={{ required: 'Please select a service type' }}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2" style={{ gap: '8px' }}>
                {SERVICE_TYPE_OPTIONS.map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(selected ? '' : opt.value)}
                      className={cn(
                        'cursor-pointer rounded-full border px-3 py-2 text-[12px] font-bold uppercase tracking-wide outline-none transition-colors',
                        selected ? 'border-transparent text-white' : 'bg-white',
                      )}
                      style={
                        selected
                          ? { backgroundColor: COS_FOREST }
                          : { borderColor: COS_FOREST, color: COS_FOREST }
                      }
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
    </>
  );
}
