'use client';

import {
  FileText, UtensilsCrossed, Calculator, Users,
  CalendarDays, ChefHat, Users2, BarChart3,
} from 'lucide-react';
import { useInView } from '@/hooks/useInView';

const MODULES = [
  {
    Icon: FileText,
    title: 'Quotation Management',
    description: 'Build, send, and track professional quotes in minutes. Auto-calculate pricing and get faster client approvals.',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    borderColor: 'border-orange-500/[0.13]',
  },
  {
    Icon: UtensilsCrossed,
    title: 'Menu Planning',
    description: 'Design event-specific menus with your full dish catalog. Set courses, quantities, and serving styles effortlessly.',
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10',
    borderColor: 'border-teal-500/[0.13]',
  },
  {
    Icon: Calculator,
    title: 'Costing Engine',
    description: 'Automatically calculate per-plate costs, margins, and profitability. Never under-quote an event again.',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    borderColor: 'border-purple-500/[0.13]',
  },
  {
    Icon: Users,
    title: 'CRM & Leads',
    description: 'Track every enquiry from first contact to signed deal. Full pipeline visibility across your entire sales team.',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    borderColor: 'border-blue-500/[0.13]',
  },
  {
    Icon: CalendarDays,
    title: 'Event Operations',
    description: 'Manage timelines, venues, guest counts, and day-of checklists. Every event runs like clockwork.',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/[0.13]',
  },
  {
    Icon: ChefHat,
    title: 'Kitchen Workflow',
    description: 'Production planning, kitchen assignments, and prep schedules. Bridge the gap between front-office and kitchen.',
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
    borderColor: 'border-rose-500/[0.13]',
  },
  {
    Icon: Users2,
    title: 'Team Coordination',
    description: 'Assign staff to events, manage roles, track availability. Run coordinated operations across large teams.',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/[0.13]',
  },
  {
    Icon: BarChart3,
    title: 'Analytics & Reports',
    description: 'Revenue trends, event performance, and client insights. Data-driven decisions for a growing catering business.',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/[0.13]',
  },
];

export default function LandingModules() {
  const { ref, inView } = useInView();

  return (
    <section id="modules" className="py-24 lg:py-32 bg-black">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-[12px] text-slate-400 mb-5">
            Everything in one platform
          </span>
          <h2 className="text-[38px] lg:text-[52px] font-bold text-white leading-tight tracking-tight mb-5">
            Every tool your catering
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
              business needs
            </span>
          </h2>
          <p className="text-[16px] lg:text-[18px] text-slate-400 max-w-xl mx-auto">
            Eight purpose-built modules that connect your entire operations from first
            contact to final delivery.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map(({ Icon, title, description, iconColor, iconBg, borderColor }, i) => (
            <div
              key={title}
              className={`group relative p-5 rounded-2xl border ${borderColor} bg-white/[0.025] hover:bg-white/[0.045] cursor-default hover:-translate-y-1`}
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.55s ease ${i * 55}ms, transform 0.55s ease ${i * 55}ms, background-color 0.3s`,
              }}
            >
              <div
                className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={1.75} />
              </div>
              <h3 className="text-[14px] font-semibold text-white mb-2">{title}</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors duration-300">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
