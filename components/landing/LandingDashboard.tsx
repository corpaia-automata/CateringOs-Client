'use client';

import { useInView } from '@/hooks/useInView';

export default function LandingDashboard() {
  const { ref, inView } = useInView(0.08);

  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-[#050B18] to-[#03060F] overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[12px] text-slate-400 mb-5">
            See it in action
          </span>
          <h2 className="text-[38px] lg:text-[52px] font-bold text-white tracking-tight mb-4">
            Your entire operation,{' '}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              beautifully organized
            </span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-slate-400 max-w-xl mx-auto">
            A real-time command center for your catering business. Every number, event, and lead in one view.
          </p>
        </div>

        <div
          ref={ref}
          className="relative"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(32px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          {/* Ambient glows */}
          <div className="absolute -inset-8 bg-teal-500/[0.035] rounded-[60px] blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-orange-500/[0.025] rounded-full blur-3xl pointer-events-none" />

          {/* Floating stat cards */}
          <div className="absolute -left-2 lg:-left-8 top-[12%] z-20 bg-[#0C1628]/95 border border-white/[0.08] rounded-2xl px-4 py-3.5 shadow-2xl hidden lg:block">
            <p className="text-[10px] text-slate-500 mb-1.5">Conversion Rate</p>
            <p className="text-[26px] font-bold text-white leading-none mb-2">68%</p>
            <div className="flex items-end gap-1">
              {[28, 52, 40, 65, 55, 78, 68].map((h, i) => (
                <div
                  key={i}
                  className="w-3 rounded-sm"
                  style={{
                    height: `${h * 0.28}px`,
                    background: i === 6 ? '#0EA5E9' : 'rgba(14,165,233,0.25)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="absolute -right-2 lg:-right-8 top-[12%] z-20 bg-[#0C1628]/95 border border-white/[0.08] rounded-2xl px-4 py-3.5 shadow-2xl hidden lg:block">
            <p className="text-[10px] text-slate-500 mb-1.5">Pending Quotations</p>
            <p className="text-[26px] font-bold text-white leading-none mb-1.5">14</p>
            <p className="text-[10px] text-orange-400">3 awaiting approval</p>
          </div>

          <div className="absolute -left-2 lg:-left-8 bottom-[12%] z-20 bg-[#0C1628]/95 border border-white/[0.08] rounded-2xl px-4 py-3.5 shadow-2xl hidden lg:block">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-[10px] text-slate-400">Live Event Now</p>
            </div>
            <p className="text-[13px] font-semibold text-white">Verma Anniversary</p>
            <p className="text-[10px] text-slate-400">280 guests · On track</p>
          </div>

          {/* Main dashboard frame */}
          <div className="rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_40px_100px_rgba(0,0,0,0.8)] bg-[#080D1A]">
            {/* Browser top bar */}
            <div className="bg-[#0C1220] border-b border-white/[0.05] px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]/70" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]/70" />
                <div className="w-3 h-3 rounded-full bg-[#28CA41]/70" />
              </div>
              <div className="flex-1 mx-3 max-w-xs bg-white/[0.05] rounded px-3 py-1 text-[11px] text-slate-500 font-mono">
                app.cateringos.in/dashboard
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </div>
            </div>

            {/* App layout */}
            <div className="flex h-[460px] sm:h-[520px] lg:h-[580px] overflow-hidden">
              {/* Sidebar */}
              <div className="w-[195px] shrink-0 bg-[#060C18] border-r border-white/[0.05] p-3.5 hidden md:flex flex-col gap-0.5">
                <div className="flex items-center gap-2 px-2 py-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <span className="text-orange-400 font-bold text-[11px]">C</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-white">CateringOS</p>
                    <p className="text-[9px] text-slate-500">Enterprise</p>
                  </div>
                </div>

                <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider px-2 mb-1">Main</p>
                {[
                  { label: 'Dashboard', active: true, badge: null },
                  { label: 'Events', active: false, badge: '3' },
                  { label: 'Leads & CRM', active: false, badge: null },
                  { label: 'Quotations', active: false, badge: '14' },
                  { label: 'Menu Builder', active: false, badge: null },
                  { label: 'Costing', active: false, badge: null },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-[12px] cursor-default ${
                      item.active
                        ? 'bg-orange-500/12 text-orange-300 border border-orange-500/15'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}

                <p className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider px-2 mb-1 mt-4">Operations</p>
                {['Kitchen Workflow', 'Team', 'Reports'].map((item) => (
                  <div
                    key={item}
                    className="flex items-center px-2.5 py-2 rounded-lg text-[12px] text-slate-500 cursor-default"
                  >
                    <span className="font-medium">{item}</span>
                  </div>
                ))}

                <div className="mt-auto pt-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-default">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
                      <span className="text-[9px] text-white font-bold">AR</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-white font-medium">Arjun Khanna</p>
                      <p className="text-[9px] text-slate-500">Owner</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 bg-[#050B16] p-4 lg:p-6 overflow-hidden">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-[15px] font-semibold text-white mb-0.5">Overview</h2>
                    <p className="text-[11px] text-slate-500">Thursday, 8 May 2025 · Season: Summer Peak</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] text-[10px] text-slate-400">
                      Last 30 days
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shadow-[0_0_12px_rgba(232,97,10,0.4)] cursor-default">
                      <span className="text-white text-[13px] font-bold leading-none">+</span>
                    </div>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Total Revenue', value: '₹24.5L', change: '+12.4%', up: true, sub: 'vs last month' },
                    { label: 'Events', value: '147', change: '+8 new', up: true, sub: 'this month' },
                    { label: 'Active Leads', value: '38', change: '12 hot', up: null, sub: 'in pipeline' },
                    { label: 'Pending Quotes', value: '14', change: '3 urgent', up: false, sub: 'awaiting' },
                  ].map((m) => (
                    <div key={m.label} className="bg-[#0A1220] border border-white/[0.06] rounded-xl p-3.5">
                      <p className="text-[10px] text-slate-500 mb-2">{m.label}</p>
                      <p className="text-[22px] font-bold text-white leading-none mb-2">{m.value}</p>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-medium ${
                            m.up === true ? 'text-green-400' : m.up === false ? 'text-red-400' : 'text-orange-400'
                          }`}
                        >
                          {m.change}
                        </span>
                        <span className="text-[9px] text-slate-600">{m.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart + leads */}
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="col-span-2 lg:col-span-3 bg-[#0A1220] border border-white/[0.06] rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-medium text-white">Revenue Trend</p>
                      <div className="flex gap-0.5">
                        {['1M', '3M', '6M', '1Y'].map((p) => (
                          <button
                            key={p}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                              p === '6M'
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-1.5 h-[100px] lg:h-[130px]">
                      {[38, 52, 44, 68, 58, 82, 72, 88, 76, 96, 85, 100].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            background:
                              i >= 10
                                ? 'linear-gradient(to top, #E8610A, #f9731680)'
                                : i >= 8
                                ? 'rgba(255,255,255,0.11)'
                                : 'rgba(255,255,255,0.06)',
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m) => (
                        <span key={m} className="text-[9px] text-slate-600 flex-1 text-center">{m}</span>
                      ))}
                    </div>
                  </div>

                  {/* Recent leads */}
                  <div className="col-span-1 lg:col-span-2 bg-[#0A1220] border border-white/[0.06] rounded-xl p-3.5">
                    <p className="text-[12px] font-medium text-white mb-3">Recent Leads</p>
                    <div className="space-y-3">
                      {[
                        { name: 'Mehta Wedding', value: '₹4.2L', status: 'Hot', dot: 'bg-red-400' },
                        { name: 'Reliance Corp', value: '₹8.5L', status: 'Warm', dot: 'bg-yellow-400' },
                        { name: 'Gupta Family', value: '₹1.8L', status: 'New', dot: 'bg-blue-400' },
                        { name: 'TechConf 2025', value: '₹12L', status: 'Hot', dot: 'bg-red-400' },
                      ].map((l) => (
                        <div key={l.name} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${l.dot} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-slate-300 truncate">{l.name}</p>
                            <p className="text-[9px] text-slate-500">{l.value}</p>
                          </div>
                          <span className="text-[9px] text-slate-500 shrink-0">{l.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#03060F] to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
