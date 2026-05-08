'use client';

import { ArrowRight } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const STEPS = [
  { step: '01', label: 'Lead', desc: 'Capture enquiry', textColor: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { step: '02', label: 'Planning', desc: 'Event details', textColor: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { step: '03', label: 'Menu', desc: 'Build the menu', textColor: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  { step: '04', label: 'Costing', desc: 'Calculate price', textColor: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { step: '05', label: 'Quotation', desc: 'Send & approve', textColor: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  { step: '06', label: 'Execution', desc: 'Day-of ops', textColor: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  { step: '07', label: 'Reports', desc: 'Analyse & grow', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
];

export default function LandingWorkflow() {
  const { ref, inView } = useInView();

  return (
    <section id="workflow" className="py-24 lg:py-32 bg-[#03060F]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[12px] text-slate-400 mb-5">
            End-to-end workflow
          </span>
          <h2 className="text-[38px] lg:text-[52px] font-bold text-white tracking-tight mb-4">
            From first contact to{' '}
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              final invoice
            </span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-slate-400 max-w-xl mx-auto">
            One continuous workflow that eliminates gaps, handoffs, and missed details between every stage of your operation.
          </p>
        </div>

        {/* Steps — horizontal scroll on mobile, row on desktop */}
        <div ref={ref} className="flex flex-wrap justify-center items-center gap-3 md:gap-0">
          {STEPS.map(({ step, label, desc, textColor, bg, border }, i) => (
            <div key={step} className="flex items-center gap-2 md:gap-0">
              <div
                className={`flex flex-col items-center p-4 lg:p-5 rounded-2xl border ${border} ${bg} text-center w-[110px] lg:w-[120px]`}
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
                  transition: `opacity 0.55s ease ${i * 75}ms, transform 0.55s ease ${i * 75}ms`,
                }}
              >
                <span className={`text-[10px] font-bold ${textColor} opacity-50 mb-1`}>{step}</span>
                <p className={`text-[15px] font-bold ${textColor} mb-0.5`}>{label}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="w-4 h-4 text-slate-700 shrink-0 mx-1.5 md:mx-2.5 hidden md:block"
                  style={{
                    opacity: inView ? 1 : 0,
                    transition: `opacity 0.5s ease ${(i + 0.5) * 75}ms`,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[13.5px] text-slate-500 mt-10 max-w-lg mx-auto">
          The entire flow is connected — no spreadsheets, no WhatsApp notes, no missed context between stages.
        </p>
      </div>
    </section>
  );
}
