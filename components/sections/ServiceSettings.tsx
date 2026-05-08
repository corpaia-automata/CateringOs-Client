import { firstArray, firstString, type SectionProps } from './types';

export default function ServiceSettings({ data }: SectionProps) {
  const services = firstArray(data, ['menu_services', 'services', 'service_settings']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-semibold text-slate-950">Service Settings</h2>
      {services.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No service settings added yet.</p>
      ) : (
        <ul className="space-y-3">
          {services.map((service, index) => {
            const label = firstString(service, ['name', 'service_name', 'label', 'type'], `Service ${index + 1}`);
            const notes = firstString(service, ['notes', 'description', 'narration'], '');
            return (
              <li key={`${label}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded bg-emerald-600 text-xs font-bold text-white">✓</span>
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  {notes ? <p className="mt-1 text-sm text-slate-500">{notes}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
