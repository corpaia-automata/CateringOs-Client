import { firstString, type SectionProps } from './types';

export default function Signature({ branding = {} }: SectionProps) {
  const footer = firstString(branding, ['footer_text'], 'Thank you for choosing our services');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Accepted By</p>
          <div className="mt-16 border-t border-slate-300 pt-3 text-sm text-slate-500">Client signature</div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Prepared By</p>
          <div className="mt-16 border-t border-slate-300 pt-3 text-sm text-slate-500">Catering team</div>
        </div>
      </div>
      <p className="mt-8 text-center text-sm font-medium text-slate-600">{footer}</p>
    </section>
  );
}
