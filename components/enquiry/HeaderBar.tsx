'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface HeaderBarProps {
  canSubmit: boolean
  onCancel: () => void
  onSubmit: () => void
}

export function HeaderBar({ canSubmit, onCancel, onSubmit }: HeaderBarProps) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">Create Enquiry</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="h-9 px-5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'black' }}
          >
            Create Enquiry
          </button>
        </div>
      </div>
    </div>
  )
}
