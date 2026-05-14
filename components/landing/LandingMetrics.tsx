const METRICS = [
  { value: '1M+', label: 'Quotations Generated', sub: 'across all businesses' },
  { value: '50K+', label: 'Events Managed', sub: 'successfully executed' },
  { value: '2,000+', label: 'Catering Teams', sub: 'onboarded and active' },
  { value: '40%', label: 'Operational Savings', sub: 'average per business' },
  { value: '₹500Cr+', label: 'Revenue Processed', sub: 'through the platform' },
];

export default function LandingMetrics() {
  return (
    <section className="border-y border-white/[0.05] bg-[#050B18]/60 backdrop-blur-sm py-12">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-4">
          {METRICS.map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-[32px] lg:text-[38px] font-bold text-white mb-1 tracking-tight">{m.value}</p>
              <p className="text-[13px] font-semibold text-slate-300 mb-0.5">{m.label}</p>
              <p className="text-[11px] text-slate-500">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
