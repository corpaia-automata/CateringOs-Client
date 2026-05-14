'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { authStorage } from '@/lib/auth';

import { ColorPicker } from './ColorPicker';
import { TemplateSelector } from './TemplateSelector';

type TemplateType = 'classic' | 'premium' | 'minimal';

interface SectionToggle {
  id: string;
  enabled: boolean;
  order: number;
}

interface TemplateRecord {
  id: string | number;
  template_type: TemplateType;
  logo?: string;
  hero_image?: string | null;
  primary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  company_tagline: string;
  about_text: string;
  why_choose_us: string;
  sections_config?: { sections?: SectionToggle[] };
}

interface BrandingFormProps {
  slug: string;
}

const HEADING_FONTS = [
  'Playfair Display',
  'Cormorant Garamond',
  'IBM Plex Sans',
  'Lora',
  'Merriweather',
] as const;

const BODY_FONTS = ['Inter', 'DM Sans', 'IBM Plex Sans', 'Nunito', 'Source Sans 3'] as const;

const DEFAULT_SECTIONS: SectionToggle[] = [
  { id: 'cover', enabled: true, order: 1 },
  { id: 'about', enabled: true, order: 2 },
  { id: 'why_us', enabled: true, order: 3 },
  { id: 'event_details', enabled: true, order: 4 },
  { id: 'menu', enabled: true, order: 5 },
  { id: 'services', enabled: true, order: 6 },
  { id: 'pricing', enabled: true, order: 7 },
  { id: 'terms', enabled: true, order: 8 },
];

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
}

function humanizeSectionName(id: string): string {
  return id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseListPayload<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { results?: unknown[] }).results)) {
    return ((raw as { results: unknown[] }).results ?? []) as T[];
  }
  return [];
}

/**
 * Branding/template editor for caterer quotation output.
 */
export function BrandingForm({ slug }: BrandingFormProps) {
  const [templateId, setTemplateId] = useState<string | number | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType>('classic');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [heroPreview, setHeroPreview] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1A1A1A');
  const [accentColor, setAccentColor] = useState('#C9A84C');
  const [fontHeading, setFontHeading] = useState<(typeof HEADING_FONTS)[number]>('Playfair Display');
  const [fontBody, setFontBody] = useState<(typeof BODY_FONTS)[number]>('Inter');
  const [companyTagline, setCompanyTagline] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [whyChooseUs, setWhyChooseUs] = useState('');
  const [sections, setSections] = useState<SectionToggle[]>(DEFAULT_SECTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const token = authStorage.getAccess();
        const res = await fetch(`${apiBase()}/api/app/${encodeURIComponent(slug)}/templates/`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Failed to fetch template (${res.status})`);
        const payload = (await res.json()) as unknown;
        const rows = parseListPayload<TemplateRecord>(payload);
        const current = rows[0];
        if (!active || !current) return;

        setTemplateId(current.id);
        setTemplateType(current.template_type || 'classic');
        setLogoPreview(current.logo || '');
        setHeroPreview(current.hero_image || '');
        setPrimaryColor(current.primary_color || '#1A1A1A');
        setAccentColor(current.accent_color || '#C9A84C');
        if (HEADING_FONTS.includes(current.font_heading as (typeof HEADING_FONTS)[number])) {
          setFontHeading(current.font_heading as (typeof HEADING_FONTS)[number]);
        }
        if (BODY_FONTS.includes(current.font_body as (typeof BODY_FONTS)[number])) {
          setFontBody(current.font_body as (typeof BODY_FONTS)[number]);
        }
        setCompanyTagline(current.company_tagline || '');
        setAboutText(current.about_text || '');
        setWhyChooseUs(current.why_choose_us || '');
        const incomingSections = current.sections_config?.sections;
        setSections(Array.isArray(incomingSections) && incomingSections.length > 0 ? incomingSections : DEFAULT_SECTIONS);
      } catch (error) {
        console.error(error);
        toast.error('Could not load branding template');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    const loadPreviewToken = async () => {
      try {
        const token = authStorage.getAccess();
        const res = await fetch(
          `${apiBase()}/api/app/${encodeURIComponent(slug)}/quotations/?latest_only=true&page_size=1`,
          {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            cache: 'no-store',
          },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as unknown;
        const rows = parseListPayload<{ public_token?: string }>(payload);
        const tokenValue = rows[0]?.public_token;
        if (active && tokenValue) setPreviewToken(String(tokenValue));
      } catch {
        // Keep silent; preview link is optional.
      }
    };
    void loadPreviewToken();
    return () => {
      active = false;
    };
  }, [slug]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (templateId == null) {
        throw new Error('Template id not found');
      }
      const auth = authStorage.getAccess();
      const fd = new FormData();
      fd.append('template_type', templateType);
      fd.append('primary_color', primaryColor);
      fd.append('accent_color', accentColor);
      fd.append('font_heading', fontHeading);
      fd.append('font_body', fontBody);
      fd.append('company_tagline', companyTagline.slice(0, 200));
      fd.append('about_text', aboutText);
      fd.append('why_choose_us', whyChooseUs);
      fd.append('sections_config', JSON.stringify({ sections }));
      if (logoFile) fd.append('logo', logoFile);
      if (heroFile) fd.append('hero_image', heroFile);

      const res = await fetch(`${apiBase()}/api/app/${encodeURIComponent(slug)}/templates/${templateId}/`, {
        method: 'PATCH',
        headers: {
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          Accept: 'application/json',
        },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Save failed (${res.status})`);
      }
      return (await res.json()) as TemplateRecord;
    },
    onSuccess: (data) => {
      setLogoFile(null);
      setHeroFile(null);
      if (data.logo) setLogoPreview(data.logo);
      if (data.hero_image) setHeroPreview(data.hero_image);
      toast.success('Branding settings saved');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save template';
      toast.error(message);
    },
  });

  const canSave = useMemo(() => {
    return companyTagline.length <= 200 && Boolean(templateId);
  }, [companyTagline.length, templateId]);

  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">Branding & Template</h1>
        <p className="mt-1 text-sm text-slate-600">Customize how your public quotation pages look and feel.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Logo</label>
            {logoPreview ? (
              <img src={logoPreview} alt="Current logo" className="h-16 w-auto rounded border border-slate-200 bg-slate-50 p-1" />
            ) : (
              <p className="text-xs text-slate-500">No logo uploaded</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setLogoFile(file);
                if (file) setLogoPreview(URL.createObjectURL(file));
              }}
              className="block w-full text-sm text-slate-700"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Hero Image (optional)</label>
            {heroPreview ? (
              <img
                src={heroPreview}
                alt="Current hero"
                className="h-20 w-full rounded border border-slate-200 object-cover"
              />
            ) : (
              <p className="text-xs text-slate-500">No hero image uploaded</p>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setHeroFile(file);
                if (file) setHeroPreview(URL.createObjectURL(file));
              }}
              className="block w-full text-sm text-slate-700"
            />
          </div>
        </div>

        <TemplateSelector value={templateType} accentColor={accentColor} onChange={setTemplateType} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ColorPicker label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorPicker label="Accent Color" value={accentColor} onChange={setAccentColor} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Font Heading</label>
            <select
              value={fontHeading}
              onChange={(event) => setFontHeading(event.target.value as (typeof HEADING_FONTS)[number])}
              className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
            >
              {HEADING_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Font Body</label>
            <select
              value={fontBody}
              onChange={(event) => setFontBody(event.target.value as (typeof BODY_FONTS)[number])}
              className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
            >
              {BODY_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Company Tagline</label>
          <input
            type="text"
            value={companyTagline}
            maxLength={200}
            onChange={(event) => setCompanyTagline(event.target.value)}
            className="h-10 w-full rounded border border-slate-300 px-3 text-sm"
          />
          <p className="text-xs text-slate-500">{companyTagline.length}/200</p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">About Text</label>
          <textarea
            value={aboutText}
            onChange={(event) => setAboutText(event.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Why Choose Us</label>
          <textarea
            value={whyChooseUs}
            onChange={(event) => setWhyChooseUs(event.target.value)}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Visible Sections</h2>
        <p className="mt-1 text-sm text-slate-600">Enable or disable sections shown on the public quotation.</p>

        <div className="mt-4 space-y-3">
          {[...sections]
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <label
                key={section.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
              >
                <span className="text-sm text-slate-800">{humanizeSectionName(section.id)}</span>
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) =>
                    setSections((prev) =>
                      prev.map((item) =>
                        item.id === section.id ? { ...item, enabled: event.target.checked } : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        {previewToken ? (
          <Link href={`/q/${previewToken}`} target="_blank" className="text-sm font-medium text-slate-900 underline">
            Preview your quote template →
          </Link>
        ) : (
          <span className="text-sm text-slate-500">Preview link available once a quotation exists.</span>
        )}
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  );
}
