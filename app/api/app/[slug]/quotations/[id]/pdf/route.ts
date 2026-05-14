import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Puppeteer needs Node (not Edge). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/app/[slug]/quotations/[id]/pdf
 * Fetches HTML from Django `export-pdf-html`, prints with Puppeteer (no GTK on Django host).
 * Pass the same Authorization: Bearer … as for other tenant APIs.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  const auth = request.headers.get('authorization');
  if (!auth?.trim()) {
    return NextResponse.json({ detail: 'Authorization header required' }, { status: 401 });
  }

  const htmlUrl = `${BASE}/api/app/${encodeURIComponent(slug)}/quotations/${encodeURIComponent(id)}/export-pdf-html/`;
  const htmlRes = await fetch(htmlUrl, {
    headers: { Authorization: auth, Accept: 'text/html' },
    cache: 'no-store',
  });

  if (!htmlRes.ok) {
    let detail = `Failed to load quotation HTML (${htmlRes.status})`;
    try {
      const j = (await htmlRes.json()) as { detail?: string };
      if (j?.detail) detail = String(j.detail);
    } catch {
      const t = await htmlRes.text();
      if (t) detail = t.slice(0, 500);
    }
    return NextResponse.json({ detail }, { status: htmlRes.status });
  }

  const html = await htmlRes.text();

  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = await import('puppeteer');
  } catch {
    return NextResponse.json(
      {
        detail:
          'puppeteer is not installed. From frontend/: npm install puppeteer — or use Django export-pdf with QUOTATION_PDF_ENGINE=auto (xhtml2pdf fallback).',
      },
      { status: 501 },
    );
  }

  let browser: import('puppeteer').Browser | undefined;
  try {
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
    });
    await browser.close();
    browser = undefined;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${id}.pdf"`,
      },
    });
  } catch (e) {
    console.error('Puppeteer PDF error', e);
    const msg = e instanceof Error ? e.message : 'Puppeteer PDF failed';
    return NextResponse.json({ detail: msg }, { status: 502 });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
