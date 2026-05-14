import type { SectionProps } from './types';

/**
 * Tenant story / about copy from branding.
 */
export function AboutSection({ branding }: SectionProps) {
  const text = (branding.about_text || '').trim();
  if (!text) {
    return null;
  }

  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <section className="q-about" aria-label="About">
      <h2 className="q-section-title">About</h2>
      <div className="q-section-body">
        {paragraphs.map((para, idx) => (
          <p key={`${idx}-${para.slice(0, 24)}`}>{para}</p>
        ))}
      </div>
    </section>
  );
}
