import type { ReactNode } from 'react';

import type { SectionProps } from './types';
import { formatCostingDisplayValue, formatInr, humanizeKey, parseAmount } from './utils';

/**
 * Subtotal, costing add-ons, and total with layout from ``schema.pricing_style``.
 */
export function PricingSection({ quotation, schema }: SectionProps) {
  const sub = parseAmount(quotation.subtotal);
  const tot = parseAmount(quotation.total);
  const costing = quotation.costing && typeof quotation.costing === 'object' ? quotation.costing : {};
  const addonEntries = Object.entries(costing).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
  );

  if (sub === null && tot === null && addonEntries.length === 0) {
    return null;
  }

  const style = schema.pricing_style;

  const totalLabel = <p className="q-pricing__row-label">Total</p>;
  const totalValue = (
    <p className="q-pricing__row-value">{tot !== null ? formatInr(tot) : '—'}</p>
  );

  let totalBlock: ReactNode;
  if (style === 'summary_box') {
    totalBlock = (
      <div className="q-price-total">
        <div className="q-pricing__row">
          {totalLabel}
          {totalValue}
        </div>
      </div>
    );
  } else if (style === 'highlight_box') {
    totalBlock = (
      <div className="q-pricing__row q-pricing__highlight-total">
        {totalLabel}
        {totalValue}
      </div>
    );
  } else {
    totalBlock = (
      <div className="q-pricing__row">
        {totalLabel}
        {totalValue}
      </div>
    );
  }

  return (
    <section className="q-pricing" aria-label="Pricing">
      <h2 className="q-section-title">Pricing</h2>
      <div className="q-section-body">
        <div className="q-pricing__rows">
          {sub !== null ? (
            <div className="q-pricing__row">
              <p className="q-pricing__row-label">Subtotal</p>
              <p className="q-pricing__row-value">{formatInr(sub)}</p>
            </div>
          ) : null}
          {addonEntries.map(([key, value]) => (
            <div key={key} className="q-pricing__row">
              <p className="q-pricing__row-label">{humanizeKey(key)}</p>
              <p className="q-pricing__row-value">{formatCostingDisplayValue(value, formatInr)}</p>
            </div>
          ))}
          {totalBlock}
        </div>
      </div>
    </section>
  );
}
