'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSubscriptionStore } from '@/store/subscriptionStore';

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const trialEndDate = useSubscriptionStore((state) => state.trialEndDate);

  const formattedEndDate = trialEndDate
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(trialEndDate))
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {reason === 'trial_expired' && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
            <p className="font-semibold">Your trial has ended.</p>
            <p className="mt-1 text-sm text-red-800">
              Choose a plan to restore access{formattedEndDate ? ` to the workspace that expired on ${formattedEndDate}` : ''}.
            </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">CateringOS Plans</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-950">Upgrade your workspace</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Pick the plan that fits your catering operations. Billing checkout can be connected here when Stripe is ready.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { name: 'Starter', price: '₹999', description: 'For small teams getting organized.' },
            { name: 'Growth', price: '₹2,499', description: 'For teams managing more events and leads.' },
            { name: 'Enterprise', price: 'Custom', description: 'For larger catering businesses.' },
          ].map((plan) => (
            <section key={plan.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">{plan.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
              <p className="mt-6 text-3xl font-bold text-slate-950">
                {plan.price}
                {plan.price !== 'Custom' && <span className="text-sm font-medium text-slate-500"> / month</span>}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {['Events and leads', 'Grocery planning', 'Quotes and reports'].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => router.push('/billing')}
                className="mt-6 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                Choose {plan.name}
              </button>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
