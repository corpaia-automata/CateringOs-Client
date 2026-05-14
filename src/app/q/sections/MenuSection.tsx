import { Fragment } from 'react';
import type { MenuDish } from '@/src/types/quotation';

import type { SectionProps } from './types';
import { dishQuantityLabel, groupDishesByCategory } from './utils';

function ComplimentaryBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="q-badge-complimentary">Complimentary</span>;
}

function MenuTable({
  categories,
  schema,
}: {
  categories: Map<string, MenuDish[]>;
  schema: SectionProps['schema'];
}) {
  const showQty = schema.show_item_quantities;
  const colCount = showQty ? 3 : 2;

  return (
    <table className="q-table">
      <thead>
        <tr>
          <th scope="col">Item</th>
          {showQty ? <th scope="col">Quantity</th> : null}
          <th scope="col"> </th>
        </tr>
      </thead>
      <tbody>
        {[...categories.entries()].map(([category, rows]) => (
          <Fragment key={category}>
            <tr className="q-menu__category-row">
              <td colSpan={colCount}>
                <h3 className="q-menu__category-title">{category}</h3>
              </td>
            </tr>
            {rows.map((dish, idx) => {
              const qty = dishQuantityLabel(dish, showQty);
              const badge = schema.show_complimentary_tags && Boolean(dish.is_complimentary);
              const rowKey = `${category}-${String(dish.id)}-${idx}`;
              return (
                <tr key={rowKey}>
                  <td>{dish.name}</td>
                  {showQty ? <td>{qty || '—'}</td> : null}
                  <td>
                    <ComplimentaryBadge show={badge} />
                  </td>
                </tr>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function MenuCards({
  categories,
  schema,
}: {
  categories: Map<string, MenuDish[]>;
  schema: SectionProps['schema'];
}) {
  return (
    <div className="q-menu__cards q-card-grid">
      {[...categories.entries()].flatMap(([category, rows]) =>
        rows.map((dish, idx) => {
          const qty = dishQuantityLabel(dish, schema.show_item_quantities);
          const badge = schema.show_complimentary_tags && Boolean(dish.is_complimentary);
          return (
            <article key={`${category}-${String(dish.id)}-${idx}`} className="q-card">
              <p className="q-menu__category-title">{category}</p>
              <h3 className="q-menu__card-title">{dish.name}</h3>
              {qty ? <p className="q-menu__card-meta">{qty}</p> : null}
              <ComplimentaryBadge show={badge} />
            </article>
          );
        }),
      )}
    </div>
  );
}

function MenuList({
  categories,
  schema,
}: {
  categories: Map<string, MenuDish[]>;
  schema: SectionProps['schema'];
}) {
  return (
    <ul className="q-list">
      {[...categories.entries()].map(([category, rows]) => (
        <li key={category} className="q-menu__category">
          <h3 className="q-menu__category-title">{category}</h3>
          <ul className="q-list">
            {rows.map((dish, idx) => {
              const qty = dishQuantityLabel(dish, schema.show_item_quantities);
              const badge = schema.show_complimentary_tags && Boolean(dish.is_complimentary);
              return (
                <li key={`${String(dish.id)}-${idx}`} className="q-list-item">
                  <span>{dish.name}</span>
                  {qty ? <span className="q-menu__row-extra">{qty}</span> : null}
                  <ComplimentaryBadge show={badge} />
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/**
 * Menu items grouped by category; layout follows ``schema.menu_layout``.
 */
export function MenuSection({ quotation, schema }: SectionProps) {
  const dishes = Array.isArray(quotation.menu_dishes) ? quotation.menu_dishes : [];
  if (dishes.length === 0) {
    return null;
  }

  const categories = groupDishesByCategory(dishes as MenuDish[]);
  const layout = schema.menu_layout;

  return (
    <section className="q-menu" aria-label="Menu">
      <h2 className="q-section-title">Menu</h2>
      <div className="q-section-body">
        {layout === 'table' ? <MenuTable categories={categories} schema={schema} /> : null}
        {layout === 'cards' ? <MenuCards categories={categories} schema={schema} /> : null}
        {layout === 'list' ? <MenuList categories={categories} schema={schema} /> : null}
      </div>
    </section>
  );
}
