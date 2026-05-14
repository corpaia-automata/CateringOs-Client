'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { LeadFormDrawer } from '@/components/leads/LeadFormDrawer';

export default function NewLeadPage() {
  const router = useRouter();
  const qc = useQueryClient();

  function handleSaved(newId?: string) {
    qc.invalidateQueries({ queryKey: ['leads'] });
    if (newId) {
      router.push(`/leads/${newId}`);
    } else {
      router.push('/leads');
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push('/leads')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-black/10 bg-white hover:bg-black/5 transition-colors shrink-0"
            aria-label="Back to leads"
          >
            <ArrowLeft size={15} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">New Lead</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fill in the details to create a lead</p>
          </div>
        </div>

        {/* Shared form — same component, same design, same fields */}
        <LeadFormDrawer
          mode="page"
          open={true}
          editing={null}
          onClose={() => router.push('/leads')}
          onSaved={handleSaved}
        />

      </div>
    </div>
  );
}
