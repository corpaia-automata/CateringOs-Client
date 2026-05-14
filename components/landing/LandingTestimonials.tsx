'use client';

import { Star } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const TESTIMONIALS = [
  {
    quote:
      'CateringOS completely transformed how we handle events. We went from juggling 5 spreadsheets to one dashboard. Our quotation time dropped from 2 hours to 15 minutes.',
    name: 'Rahul Mehta',
    role: 'Owner',
    company: 'Mehta Fine Catering',
    meta: '120+ events/year',
    avatar: 'RM',
    gradient: 'from-orange-500 to-amber-500',
    featured: false,
  },
  {
    quote:
      'The costing engine alone saved us from under-quoting three major corporate events. We have increased our average event margin by 18% since switching to CateringOS.',
    name: 'Priya Sharma',
    role: 'Operations Head',
    company: 'Royal Bites Events',
    meta: 'Enterprise caterer',
    avatar: 'PS',
    gradient: 'from-teal-500 to-cyan-400',
    featured: true,
  },
  {
    quote:
      'Lead tracking was always our weak point. The CRM gave us full pipeline visibility. We are now converting 40% more leads than before and our team collaboration is seamless.',
    name: 'Arun Kumar',
    role: 'CEO',
    company: 'Grand Feast Co.',
    meta: '300+ events/year',
    avatar: 'AK',
    gradient: 'from-purple-500 to-indigo-400',
    featured: false,
  },
];

export default function LandingTestimonials() {
  const { ref, inView } = useInView();

  return (
    <section className="py-24 lg:py-32 bg-[#050B18]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[12px] text-slate-400 mb-5">
            Customer stories
          </span>
          <h2 className="text-[38px] lg:text-[48px] font-bold text-white tracking-tight mb-4">
            Loved by catering teams
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              across India
            </span>
          </h2>
          <p className="text-[15px] text-slate-400 max-w-md mx-auto">
            Real results from real catering businesses that made the switch.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(({ quote, name, role, company, meta, avatar, gradient, featured }, i) => (
            <div
              key={name}
              className={`relative p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                featured
                  ? 'border-orange-500/25 bg-gradient-to-b from-orange-500/[0.07] via-orange-500/[0.03] to-transparent shadow-[0_0_60px_rgba(232,97,10,0.08)]'
                  : 'border-white/[0.06] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]'
              }`}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(22px)',
                transition: `opacity 0.65s ease ${i * 110}ms, transform 0.65s ease ${i * 110}ms`,
              }}
            >
              {featured && (
                <span className="absolute -top-3 left-5 px-2.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-semibold shadow-[0_0_12px_rgba(232,97,10,0.4)]">
                  Featured
                </span>
              )}

              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                ))}
              </div>

              <p className="text-[14px] text-slate-300 leading-[1.7] mb-5 flex-1">
                &ldquo;{quote}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}
                >
                  <span className="text-[11px] text-white font-bold">{avatar}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white">{name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {role}, {company}
                  </p>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">{meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
