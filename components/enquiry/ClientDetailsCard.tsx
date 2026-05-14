'use client'

interface ClientDetailsCardProps {
  clientName: string
  phone: string
  onChange: (field: 'clientName' | 'phone', value: string) => void
}

export function ClientDetailsCard({ clientName, phone, onChange }: ClientDetailsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
        Client Details
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
            Client Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => onChange('clientName', e.target.value)}
            placeholder="Enter client name"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-slate-600 mb-1.5">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="Enter phone number"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>
    </div>
  )
}
