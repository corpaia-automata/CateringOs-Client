import { firstNumber, formatMoney, type SectionProps } from './types';

export default function PricingSummary({ data }: SectionProps) {
  const subtotal = firstNumber(data, ['subtotal', 'pricing_data.subtotal', 'total_amount']);
  const tax = subtotal * 0.05;
  const advance = firstNumber(data, ['advance_amount', 'pricing_data.advance_amount']);
  const finalTotal = firstNumber(data, ['final_selling_price', 'pricing_data.final_selling_price', 'total_amount'], subtotal + tax);

  const rows = [
    ['Subtotal', subtotal],
    ['Tax 5%', tax],
    ['Advance', advance],
    ['Final Total', finalTotal],
  ] as const;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-semibold text-slate-950">Pricing Summary</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-200">
            {rows.map(([label, value]) => (
              <tr key={label} className={label === 'Final Total' ? 'bg-slate-950 text-white' : 'bg-white'}>
                <td className="px-4 py-3 font-medium">{label}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
