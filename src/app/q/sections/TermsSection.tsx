import type { SectionProps } from './types';

/**
 * Footer line from template schema and optional print page indicator (see print.css).
 */
export function TermsSection({ schema }: SectionProps) {
  const footer = (schema.footer_text || '').trim();
  const showPage = schema.show_page_numbers;

  if (!footer && !showPage) {
    return null;
  }

  return (
    <footer className="q-terms" aria-label="Terms">
      {footer ? (
        <div className="q-section-body">
          <p className="q-terms__footer">{footer}</p>
        </div>
      ) : null}
      {showPage ? <p className="q-terms-page-marker" aria-hidden="true" /> : null}
    </footer>
  );
}
