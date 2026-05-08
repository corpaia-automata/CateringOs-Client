'use client';

import Link from 'next/link';
import { ArrowRight, Play, TrendingUp, Calendar } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#03060F] pt-24 pb-16">
      {/* Background atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-orange-500/[0.06] rounded-full blur-[140px]" />
        <div className="absolute top-[35%] left-[10%] w-[500px] h-[400px] bg-teal-500/[0.03] rounded-full blur-[110px]" />
        <div className="absolute top-[25%] right-[5%] w-[400px] h-[400px] bg-orange-600/[0.03] rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* Badge */}
      <div className="relative mb-7 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/25 bg-orange-500/[0.07] backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-[12.5px] text-orange-300 font-medium tracking-wide">
          Trusted by 200+ catering businesses across India
        </span>
      </div>

      {/* Headline */}
      <div className="relative text-center max-w-4xl mx-auto px-5">
        <h1 className="text-[50px] sm:text-[64px] lg:text-[78px] font-bold leading-[1.05] tracking-[-0.02em] text-white mb-6">
          The Operating System
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-amber-300 bg-clip-text text-transparent">
            {' '}for Catering Businesses
          </span>
        </h1>

        <p className="text-[17px] lg:text-[19px] text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
          From first inquiry to final execution — manage quotations, menus, costing,
          CRM, and every operation from one unified platform built for modern caterers.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-[15px] rounded-xl transition-all duration-200 shadow-[0_0_40px_rgba(232,97,10,0.3)] hover:shadow-[0_0_55px_rgba(232,97,10,0.5)] hover:scale-[1.02]"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button className="group inline-flex items-center gap-2.5 px-7 py-3.5 text-white font-medium text-[15px] rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.07] transition-all duration-200">
            <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
              <Play className="w-3 h-3 fill-white text-white ml-0.5" />
            </span>
            Watch Demo
          </button>
        </div>
        <p className="text-[12.5px] text-slate-500">
          14-day free trial · No credit card required · Setup in minutes
        </p>
      </div>

      {/* Dashboard mockup */}
      <div className="relative mt-16 w-full max-w-6xl mx-auto px-4 lg:px-6">
        {/* Ambient glow beneath mockup */}
        <div className="absolute -inset-4 bg-orange-500/[0.04] rounded-3xl blur-3xl pointer-events-none" />

        {/* Floating cards */}
        <div className="absolute -top-5 right-4 lg:right-8 z-20 bg-[#0D1B35]/90 backdrop-blur-sm border border-white/[0.09] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-2xl">
          <span className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-400" />
          </span>
          <div>
            <p className="text-[10px] text-slate-400">Revenue this month</p>
            <p className="text-sm font-semibold text-white">
              +₹12.4L <span className="text-green-400 text-xs font-medium">↑ 32%</span>
            </p>
          </div>
        </div>

        <div className="absolute -bottom-4 left-4 lg:left-8 z-20 bg-[#0D1B35]/90 backdrop-blur-sm border border-white/[0.09] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <div>
            <p className="text-[10px] text-slate-400">New lead received</p>
            <p className="text-[12px] font-medium text-white">The Grand Palace Wedding</p>
          </div>
        </div>

        <div className="absolute top-1/3 -right-2 lg:-right-4 z-20 bg-[#0D1B35]/90 backdrop-blur-sm border border-white/[0.09] rounded-xl px-3 py-2.5 shadow-2xl hidden lg:block">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] text-slate-400">Next Event</span>
          </div>
          <p className="text-xs font-semibold text-white">Tomorrow, 6PM</p>
          <p className="text-[10px] text-slate-400">Corporate Gala · 450 pax</p>
        </div>

        {/* Browser chrome */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.75)] bg-[#0A0F1C]">
          <div className="bg-[#0D1525] px-4 py-3 flex items-center gap-3 border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]/70" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]/70" />
              <div className="w-3 h-3 rounded-full bg-[#28CA41]/70" />
            </div>
            <div className="flex-1 mx-3 max-w-xs bg-white/[0.05] rounded-md px-3 py-1 text-[11px] text-slate-500 font-mono">
              app.cateringos.in/dashboard
            </div>
          </div>

          {/* App UI */}
          <div className="flex h-[360px] sm:h-[420px] lg:h-[460px] overflow-hidden">
            {/* Sidebar */}
            <div className="w-[170px] lg:w-[195px] shrink-0 bg-[#080E1C] border-r border-white/[0.05] p-3 hidden sm:flex flex-col gap-0.5">
              <div className="flex items-center gap-2 px-2 py-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center">
                  <span className="text-orange-400 text-[10px] font-bold">C</span>
                </div>
                <span className="text-[12px] font-semibold text-white">CateringOS</span>
              </div>

              {[
                { label: 'Dashboard', active: true },
                { label: 'Events', active: false },
                { label: 'Leads & CRM', active: false },
                { label: 'Quotations', active: false },
                { label: 'Menu Builder', active: false },
                { label: 'Analytics', active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] cursor-default ${
                    item.active
                      ? 'bg-orange-500/12 text-orange-300 border border-orange-500/15'
                      : 'text-slate-500'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-orange-400' : 'bg-transparent'}`} />
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}

              <div className="mt-auto pt-3 border-t border-white/[0.04]">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">TK</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white font-medium">Team Kitchen</p>
                    <p className="text-[9px] text-slate-500">Admin</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 bg-[#060B16] p-4 lg:p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-white">Good morning, Team 👋</h2>
                  <p className="text-[11px] text-slate-500">Thursday, 8 May 2025</p>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-white/[0.05] text-[10px] text-slate-400 border border-white/[0.06]">
                  May 2025
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                {[
                  { label: 'Revenue', value: '₹24.5L', change: '+12%', color: 'text-green-400', bg: 'bg-green-500/10' },
                  { label: 'Events', value: '147', change: '+8%', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Leads', value: '38', change: '+24%', color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'Quotations', value: '92', change: '+15%', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map((m) => (
                  <div key={m.label} className="bg-[#0D1525]/80 border border-white/[0.06] rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 mb-1.5">{m.label}</p>
                    <p className="text-[16px] font-bold text-white leading-none mb-1.5">{m.value}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${m.bg} ${m.color}`}>
                      {m.change}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chart + list */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3 bg-[#0D1525]/80 border border-white/[0.06] rounded-xl p-3">
                  <p className="text-[11px] font-medium text-white mb-3">Revenue Overview</p>
                  <div className="flex items-end gap-1 h-[90px] lg:h-[110px]">
                    {[38, 55, 42, 72, 58, 85, 70, 92, 78, 100, 86, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${h}%`,
                          background:
                            i >= 10
                              ? 'linear-gradient(to top, #E8610A, #f97316)'
                              : 'rgba(255,255,255,0.07)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((m) => (
                      <span key={m} className="text-[9px] text-slate-600">{m}</span>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 bg-[#0D1525]/80 border border-white/[0.06] rounded-xl p-3">
                  <p className="text-[11px] font-medium text-white mb-2.5">Upcoming</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Kapoor Wedding', tag: 'Wedding', color: 'bg-pink-500/15 text-pink-300' },
                      { name: 'TCS Conference', tag: 'Corporate', color: 'bg-blue-500/15 text-blue-300' },
                      { name: 'Sharma Bday', tag: 'Social', color: 'bg-purple-500/15 text-purple-300' },
                    ].map((e) => (
                      <div key={e.name} className="flex items-center justify-between">
                        <p className="text-[10px] font-medium text-slate-300 truncate pr-2">{e.name}</p>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0 ${e.color}`}>
                          {e.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fade-out at bottom */}
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#03060F] to-transparent pointer-events-none rounded-b-2xl z-10" />
      </div>
    </section>
  );
}
