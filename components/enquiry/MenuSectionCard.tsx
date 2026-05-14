'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

export interface MenuSection {
  id: string
  name: string
  items: string[]
}

interface MenuSectionCardProps {
  section: MenuSection
  canDelete: boolean
  onAddItem: (sectionId: string, item: string) => void
  onRemoveItem: (sectionId: string, itemIndex: number) => void
  onRemoveSection: (sectionId: string) => void
}

export function MenuSectionCard({
  section,
  canDelete,
  onAddItem,
  onRemoveItem,
  onRemoveSection,
}: MenuSectionCardProps) {
  const [adding, setAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')

  function handleAdd() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onAddItem(section.id, trimmed)
    setInputValue('')
    setAdding(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      setAdding(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Category header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="text-[13px] font-bold text-slate-700 uppercase tracking-wide">
          {section.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-colors"
            style={{ background: 'black' }}
          >
            <Plus size={13} strokeWidth={2.5} />
            Add item
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onRemoveSection(section.id)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Items body */}
      <div className="p-4">
        {section.items.length === 0 && !adding ? (
          <p className="text-[13px] text-slate-400 text-center py-4">
            No dishes yet — tap &lsquo;+ Add item&rsquo; above
          </p>
        ) : (
          <ul className="space-y-2 mb-2">
            {section.items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-sm text-slate-700">{item}</span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(section.id, idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <div className="flex gap-2 mt-2">
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Chicken Tikka"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-colors placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="px-3 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40 transition-colors"
              style={{ background: '#D95F0E' }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setInputValue('')
                setAdding(false)
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
