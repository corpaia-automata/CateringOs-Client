'use client';

import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import CreateDishForm from '../CreateDishForm';

export default function CreateDishPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const listPath = `/app/${slug}/master`;

  return (
    <div className="max-w-5xl" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: '#fff', borderBottom: '1px solid #F1F5F9' }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(listPath)}
            className="p-1.5 rounded-lg transition-colors hover:bg-slate-100"
            title="Back to dishes"
          >
            <ArrowLeft size={18} style={{ color: '#64748B' }} />
          </button>
          <div>
            <h1 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              Add New Dish
            </h1>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Fill in the details below to create a new dish
            </p>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        <CreateDishForm />
      </div>
    </div>
  );
}
