'use client'

interface EventDetails {
  eventDate: string
  eventTime: string
  venue: string
  guests: string
}

interface EventDetailsCardProps {
  values: EventDetails
  onChange: (field: keyof EventDetails, value: string) => void
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'

export function EventDetailsCard({ values, onChange }: EventDetailsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
        Event Details
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
              Event Date
            </label>
            <input
              type="date"
              value={values.eventDate}
              onChange={(e) => onChange('eventDate', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-1.5">Time</label>
            <input
              type="time"
              value={values.eventTime}
              onChange={(e) => onChange('eventTime', e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-slate-600 mb-1.5">Venue</label>
          <input
            type="text"
            value={values.venue}
            onChange={(e) => onChange('venue', e.target.value)}
            placeholder="Enter venue name or address"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-slate-600 mb-1.5">Guests</label>
          <input
            type="number"
            min="1"
            value={values.guests}
            onChange={(e) => onChange('guests', e.target.value)}
            placeholder="Expected guest count"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
