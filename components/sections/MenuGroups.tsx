import { asRecord, firstArray, firstString, type SectionProps } from './types';

export default function MenuGroups({ data, config }: SectionProps) {
  const dishes = firstArray(data, ['menu_dishes', 'line_items', 'menu.items']);
  const showQuantities = Boolean(config.show_quantities);
  const grouped = dishes.reduce<Record<string, unknown[]>>((acc, dish) => {
    const category = firstString(dish, ['category', 'dish_category', 'category_name'], 'Menu');
    acc[category] = [...(acc[category] ?? []), dish];
    return acc;
  }, {});

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Menu</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Selected Menu Groups</h2>
      </div>

      {Object.entries(grouped).length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No menu items added yet.</p>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white">
                {category}
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const record = asRecord(item);
                  const name = firstString(record, ['dish_name_snapshot', 'dish_name', 'dish', 'name'], 'Dish');
                  const quantity = firstString(record, ['quantity', 'qty', 'pax'], '');
                  const unit = firstString(record, ['unit', 'unit_type_snapshot', 'unit_type'], '');

                  return (
                    <div key={`${category}-${name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="font-medium text-slate-800">{name}</span>
                      {showQuantities && quantity ? (
                        <span className="text-sm text-slate-500">{quantity} {unit}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
