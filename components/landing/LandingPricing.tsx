'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const PLANS = [
  {
    name: 'Free Trial',
    price: '7 Days',
    period: 'Free',
    description:
      'Explore CateringOS with full platform access before upgrading.',
    features: [
      'Lead management',
      'Quotation builder',
      'Event management',
      'Menu planning',
      'Basic reports',
      'CRM access',
    ],
    cta: 'Start Free Trial',
    href: '/register',
    featured: false,
  },
  {
    name: 'Growth',
    price: '₹2,500',
    period: '/month',
    description:
      'Complete catering operations platform for growing businesses.',
    features: [
      'Unlimited events',
      'Advanced reports',
      'Kitchen workflow',
      'Multi-user access',
      'Priority support',
      'Business analytics',
    ],
    cta: 'Get Started',
    href: '/register',
    featured: true,
  },
];

export default function LandingPricing() {
  const { ref, inView } = useInView();

  return (
    <section id="pricing" className="py-24 lg:py-32 bg-black">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[12px] text-slate-400 mb-5">
            Simple pricing
          </span>
          <h2 className="text-[38px] lg:text-[52px] font-bold text-white tracking-tight mb-4">
            Pricing that scales with{' '}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              your growth
            </span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-slate-400 max-w-lg mx-auto">
            Start free, grow on Growth, scale on Enterprise. No hidden fees. Cancel anytime.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {PLANS.map(({ name, price, period, description, features, cta, href, featured, badge }, i) => (
            <div
              key={name}
              className={`relative p-6 rounded-2xl border flex flex-col transition-all duration-300 ${
                featured
                  ? 'border-orange-500/30 bg-gradient-to-b from-orange-500/[0.08] via-orange-500/[0.03] to-transparent shadow-[0_0_70px_rgba(232,97,10,0.1)]'
                  : 'border-white/[0.07] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]'
              }`}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView
                  ? featured
                    ? 'translateY(-6px)'
                    : 'translateY(0)'
                  : 'translateY(24px)',
                transition: `opacity 0.65s ease ${i * 100}ms, transform 0.65s ease ${i * 100}ms`,
              }}
            >
              {badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-orange-500 text-white text-[11px] font-semibold whitespace-nowrap shadow-[0_0_14px_rgba(232,97,10,0.5)]">
                  {badge}
                </span>
              )}

              <div className="mb-5">
                <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-[40px] font-bold text-white leading-none tracking-tight">{price}</span>
                  {period && <span className="text-slate-400 text-sm mb-1">{period}</span>}
                </div>
                <p className="text-[13px] text-slate-500 leading-relaxed">{description}</p>
              </div>

              <ul className="space-y-2.5 mb-7 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className={`w-4 h-4 mt-0.5 shrink-0 ${featured ? 'text-orange-400' : 'text-teal-400'}`}
                    />
                    <span className="text-[13px] text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={href}
                className={`w-full py-3 rounded-xl text-[14px] font-semibold text-center transition-all duration-200 ${
                  featured
                    ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-[0_0_30px_rgba(232,97,10,0.2)] hover:shadow-[0_0_42px_rgba(232,97,10,0.38)]'
                    : 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/[0.08] hover:border-white/[0.14]'
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-slate-600 mt-8">
          All plans include a 14-day free trial · No credit card required
        </p>
      </div>
    </section>
  );
}
