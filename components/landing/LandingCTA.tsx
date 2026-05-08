'use client';

import Link from 'next/link';
import { ArrowRight, ChefHat } from 'lucide-react';
import { useInView } from '@/hooks/useInView';

export default function LandingCTA() {
  const { ref, inView } = useInView();

  return (
    <section className="py-24 lg:py-32 bg-[#050B18] relative overflow-hidden">
      {/* Atmospheric glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[450px] bg-orange-500/[0.07] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-orange-400/[0.05] rounded-full blur-[60px]" />
      </div>

      <div
        ref={ref}
        className="relative max-w-4xl mx-auto text-center px-5 lg:px-8"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        <div className="mb-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-orange-500/25 bg-orange-500/[0.06]">
          <ChefHat className="w-4 h-4 text-orange-400" />
          <span className="text-[12.5px] text-orange-300 font-medium">
            Start your free trial today
          </span>
        </div>

        <h2 className="text-[42px] lg:text-[62px] font-bold text-white leading-[1.05] tracking-tight mb-5">
          Ready to run your catering
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-300 bg-clip-text text-transparent">
            business smarter?
          </span>
        </h2>

        <p className="text-[17px] lg:text-[18px] text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Join 2,000+ catering businesses who have replaced their spreadsheets, WhatsApp
          notes, and guesswork with CateringOS.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-[15px] rounded-xl transition-all duration-200 shadow-[0_0_50px_rgba(232,97,10,0.3)] hover:shadow-[0_0_65px_rgba(232,97,10,0.5)] hover:scale-[1.02]"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button className="px-8 py-4 text-white font-medium text-[15px] rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-200">
            Schedule a Demo
          </button>
        </div>

        <p className="text-[12px] text-slate-600 mt-5">
          14-day free trial · No credit card · Setup in minutes · Cancel anytime
        </p>
      </div>
    </section>
  );
}
