import { NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Proxies to Django tenant quotations API (same contract as `lib/api` client).
 * GET /api/quotations?slug=TENANT&latestOnly=true&...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug?.trim()) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  const upstream = new URL(`${BASE}/api/app/${encodeURIComponent(slug)}/quotations/`);
  url.searchParams.forEach((value, key) => {
    if (key === 'slug') return;
    if (key === 'latestOnly') {
      if (value === 'true') upstream.searchParams.set('latest_only', 'true');
      return;
    }
    upstream.searchParams.append(key, value);
  });

  const auth = request.headers.get('authorization');
  const upstreamRes = await fetch(upstream.toString(), {
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const raw = await upstreamRes.text();
  let json: unknown = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { detail: raw.slice(0, 200) };
  }

  return NextResponse.json(json, { status: upstreamRes.status });
}
