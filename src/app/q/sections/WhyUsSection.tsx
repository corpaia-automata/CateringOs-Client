import type { SectionProps } from './types';

/**
 * Why choose us content from branding.
 */
export function WhyUsSection({ branding }: SectionProps) {
  const text = (branding.why_choose_us || '').trim();
  if (!text) {
    return null;
  }

  return (
    <section className="q-why-us" aria-label="Why choose us">
      <h2 className="q-section-title">Why choose us</h2>
      <div className="q-section-body">
        <p>{text}</p>
      </div>
    </section>
  );
}
