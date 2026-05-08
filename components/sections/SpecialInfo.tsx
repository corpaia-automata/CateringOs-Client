import { firstArray, firstString, type SectionProps } from './types';

export default function SpecialInfo({ data }: SectionProps) {
  const notes = firstString(data, ['special_info', 'special_notes', 'notes', 'inquiry.notes'], '');
  const manualCosts = firstArray(data, ['manual_costs']);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-semibold text-slate-950">Special Information</h2>
      {notes ? (
        <p className="whitespace-pre-line rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{notes}</p>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No special information added.</p>
      )}
      {manualCosts.length ? (
        <div className="mt-4 space-y-2">
          {manualCosts.map((cost, index) => (
            <div key={index} className="flex justify-between rounded-lg border border-slate-200 px-4 py-2 text-sm">
              <span>{firstString(cost, ['label', 'name'], `Cost ${index + 1}`)}</span>
              <span>{firstString(cost, ['amount', 'value'], '-')}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
