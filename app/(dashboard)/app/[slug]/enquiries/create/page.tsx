'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { UtensilsCrossed, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { HeaderBar } from '@/components/enquiry/HeaderBar'
import PersonalDetailsForm from './components/PersonalDetailsForm'
import MenuSectionCard from './components/MenuSectionCard'
import type { FormValues } from './types'

const DEFAULT_SECTIONS: FormValues['menuSections'] = [
  { name: 'Welcome Drink', items: [] },
  { name: 'Starter & Soups', items: [] },
  { name: 'Main Course', items: [] },
]

export default function CreateEnquiryPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    defaultValues: {
      clientName: '',
      contactNumber: '',
      sourceChannel: '',
      eventDate: '',
      eventTime: '',
      venue: '',
      guestCount: '',
      eventType: '',
      serviceType: '',
      menuSections: DEFAULT_SECTIONS,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'menuSections',
  })

  const clientName = form.watch('clientName')
  const guestCount = parseInt(form.watch('guestCount') || '0', 10)
  const canSubmit = clientName.trim().length > 0 && !submitting

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      await api.post('/inquiries/', {
        customer_name: values.clientName.trim(),
        contact_number: values.contactNumber.trim() || undefined,
        source_channel: values.sourceChannel || undefined,
        event_type: values.eventType || undefined,
        tentative_date: values.eventDate || undefined,
        venue: values.venue.trim() || undefined,
        guest_count: values.guestCount ? parseInt(values.guestCount, 10) : undefined,
        notes: [
          values.eventTime && `Time: ${values.eventTime}`,
          values.serviceType && `Service: ${values.serviceType}`,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
      })
      toast.success('Enquiry created')
      router.back()
    } catch {
      toast.error('Failed to create enquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <HeaderBar
        canSubmit={canSubmit}
        onCancel={() => router.back()}
        onSubmit={onSubmit}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT COLUMN — 40% */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <PersonalDetailsForm form={form} />
          </div>

          {/* RIGHT COLUMN — 60% */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(217,95,14,0.10)' }}
                  >
                    <UtensilsCrossed size={16} style={{ color: 'black' }} />
                  </div>
                  <h2 className="text-[15px] font-bold text-slate-900">Menu &amp; Packages</h2>
                </div>

                <button
                  type="button"
                  onClick={() => append({ name: '', items: [] })}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-semibold text-white transition-colors"
                  style={{ background: 'black' }}
                >
                  <Plus size={14} strokeWidth={2.25} />
                  Add Category
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {fields.map((field, index) => (
                  <MenuSectionCard
                    key={field.id}
                    control={form.control}
                    register={form.register}
                    setValue={form.setValue}
                    sectionIndex={index}
                    guestCount={guestCount}
                    canDelete={fields.length > 1}
                    onRemove={() => remove(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
