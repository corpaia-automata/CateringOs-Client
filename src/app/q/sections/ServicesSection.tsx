import type { SectionProps } from './types';
import { equipmentAsStrings } from './utils';

/**
 * Additional staffing and equipment lines from ``menu_services``.
 */
export function ServicesSection({ quotation }: SectionProps) {
  const rows = Array.isArray(quotation.menu_services) ? quotation.menu_services : [];
  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="q-services" aria-label="Services">
      <h2 className="q-section-title">Services</h2>
      <div className="q-section-body">
        {rows.flatMap((svc, idx) => {
          const name = (svc.name || '').trim();
          if (!name) return [];
          const staff = typeof svc.staff_count === 'number' ? svc.staff_count : 0;
          const counters = typeof svc.counter_count === 'number' ? svc.counter_count : 0;
          const equip = equipmentAsStrings(svc.equipment_list as unknown);
          const equipLine = equip.filter(Boolean).join(', ');
          return [
            <div key={`${String(svc.id)}-${idx}`} className="q-services__row">
              <p className="q-services__name">{name}</p>
              <p className="q-services__meta">
                Staff: {staff}
                {counters > 0 ? ` · Counters: ${counters}` : null}
              </p>
              {equipLine ? <p className="q-services__equipment">Equipment: {equipLine}</p> : null}
            </div>,
          ];
        })}
      </div>
    </section>
  );
}
