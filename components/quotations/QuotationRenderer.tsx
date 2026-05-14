import { sectionRegistry } from '@/lib/sectionRegistry';
import { asRecord, type BrandingConfig, type SectionRecord, type TemplateConfig } from '@/components/sections/types';

interface TemplatePage extends SectionRecord {
  page?: number;
  label?: string;
  sections?: string[];
}

interface QuotationRendererProps {
  quotation: SectionRecord;
}

export default function QuotationRenderer({ quotation }: QuotationRendererProps) {
  const config = getQuotationConfig(quotation);
  const branding = asRecord(config.branding) as BrandingConfig;
  const pages = getPages(config);

  if (pages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No quotation template pages configured.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 bg-slate-100 p-6 print:bg-white print:p-0">
      {pages.map((page, pageIndex) => (
        <section
          key={`${page.page ?? pageIndex}-${page.label ?? 'page'}`}
          className="min-h-[1120px] bg-white p-8 shadow-sm print:min-h-screen print:shadow-none"
          style={{ pageBreakAfter: 'always' }}
        >
          {page.label ? (
            <div className="mb-6 border-b border-slate-200 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Page {page.page ?? pageIndex + 1}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">{page.label}</h1>
            </div>
          ) : null}

          <div className="space-y-6">
            {(page.sections ?? []).map((sectionKey) => {
              const SectionComponent = sectionRegistry[sectionKey];
              if (!SectionComponent) {
                return (
                  <div key={sectionKey} className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Unknown section: {sectionKey}
                  </div>
                );
              }

              return (
                <SectionComponent
                  key={sectionKey}
                  data={quotation}
                  branding={branding}
                  config={config}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function getQuotationConfig(quotation: SectionRecord): TemplateConfig {
  if (quotation.is_locked && quotation.template_snapshot) {
    return snapshotToConfig(asRecord(quotation.template_snapshot));
  }

  const template = asRecord(quotation.template);
  if (Array.isArray(template.sections_config)) {
    return newTemplateRowToConfig(template);
  }

  const layoutConfig = asRecord(template.layout_config) as TemplateConfig;
  const existingBranding = asRecord(layoutConfig.branding);
  const branding = {
    logo_url: template.logo_url,
    brand_color: template.brand_color,
    cover_image_url: template.cover_image_url,
    company_bio: template.company_bio,
    footer_text: template.footer_text,
    ...existingBranding,
  };

  return {
    ...layoutConfig,
    branding: branding as BrandingConfig,
  };
}

/** Normalizes `to_snapshot()` / API template fields for the renderer. */
function snapshotToConfig(snap: SectionRecord): TemplateConfig {
  const branding: BrandingConfig = {
    logo_url: typeof snap.logo_url === 'string' ? snap.logo_url : undefined,
    brand_color: typeof snap.primary_color === 'string' ? snap.primary_color : undefined,
    cover_image_url: '',
    company_bio: typeof snap.tagline === 'string' ? snap.tagline : undefined,
    footer_text: typeof snap.footer_text === 'string' ? snap.footer_text : undefined,
  };
  return {
    ...snap,
    branding,
  };
}

function newTemplateRowToConfig(template: SectionRecord): TemplateConfig {
  const sections = Array.isArray(template.sections_config)
    ? template.sections_config.map((s) => asRecord(s))
    : [];
  const sorted = [...sections].sort(
    (a, b) => (Number(a.order ?? 99) as number) - (Number(b.order ?? 99) as number),
  );
  const branding: BrandingConfig = {
    logo_url: typeof template.logo_url === 'string' ? template.logo_url : undefined,
    brand_color: typeof template.primary_color === 'string' ? template.primary_color : undefined,
    cover_image_url: '',
    company_bio: typeof template.tagline === 'string' ? template.tagline : undefined,
    footer_text: typeof template.footer_text === 'string' ? template.footer_text : undefined,
  };
  return {
    ...template,
    sections: sorted,
    branding,
  };
}

function getPages(config: TemplateConfig): TemplatePage[] {
  const c = asRecord(config);
  if (Array.isArray(config.pages)) {
    return config.pages.map((page) => {
      const record = asRecord(page);
      return {
        ...record,
        sections: Array.isArray(record.sections)
          ? record.sections.filter((section): section is string => typeof section === 'string')
          : [],
      };
    });
  }

  const raw = Array.isArray(c.sections) ? c.sections : [];
  return raw
    .filter((s) => asRecord(s).enabled !== false)
    .map((s, i) => {
      const sr = asRecord(s);
      const id = typeof sr.id === 'string' ? sr.id : 'section';
      return {
        page: i + 1,
        label: typeof sr.label === 'string' ? sr.label : id,
        sections: [id],
      };
    });
}
