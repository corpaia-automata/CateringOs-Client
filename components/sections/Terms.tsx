const TERMS = [
  'This quotation is valid for 7 days from the date of issue.',
  'Final guest count and menu changes must be confirmed before event execution.',
  'Advance payment is required to confirm the booking.',
  'Additional services, venue requirements, or last-minute changes may be billed separately.',
  'All prices are subject to applicable taxes unless stated otherwise.',
];

export default function Terms() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-semibold text-slate-950">Terms & Conditions</h2>
      <ol className="space-y-3 text-sm leading-6 text-slate-700">
        {TERMS.map((term, index) => (
          <li key={term} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <span>{term}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
