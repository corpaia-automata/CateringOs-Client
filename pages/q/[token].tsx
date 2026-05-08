import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export type PricingStyle = 'simple_total' | 'tax_table' | 'per_head' | string;

export type TemplateSnapshot = {
  business_name?: string;
  tagline?: string;
  logo_url?: string;
  phone?: string;
  footer_text?: string;
  primary_color?: string;
  accent_color?: string;
  font_family?: string;
  pricing_style?: PricingStyle;
  tax_percent?: number;
  advance_percent?: number;
  terms_clauses?: Array<string | { text?: string; clause?: string }>;
  sections?: unknown[];
};

export type LineItem = {
  dish_name?: string;
  name?: string;
  quantity?: number | string;
  qty?: number | string;
  unit?: string;
  category?: string;
  compliment?: boolean;
  complimentary?: boolean;
  is_compliment?: boolean;
};

export type QuotePublicPayload = {
  quote_number: string;
  status: string;
  customer_name: string;
  event_date: string | null;
  venue: string;
  pax: number | null;
  template_snapshot: TemplateSnapshot | Record<string, unknown> | null;
  line_items: LineItem[];
  pricing_data: Record<string, unknown>;
  total_amount: string;
  final_selling_price: string;
  valid_until: string | null;
  is_locked: boolean;
};

type PageProps = {
  quote: QuotePublicPayload | null;
  token: string;
  error?: string;
};

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function fmtINR(n: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(n));
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function lineTitle(item: LineItem): string {
  return String(item.dish_name || item.name || 'Item').trim();
}

function lineQty(item: LineItem): string {
  const q = item.qty ?? item.quantity ?? '';
  const u = item.unit || '';
  if (q === '' || q === undefined) return u || '—';
  return u ? `${q} ${u}` : String(q);
}

function isCompliment(item: LineItem): boolean {
  return !!(item.compliment || item.complimentary || item.is_compliment);
}

function groupedLineItems(items: LineItem[]): { category: string; rows: LineItem[] }[] {
  const map = new Map<string, LineItem[]>();
  for (const item of items || []) {
    const cat = String(item.category || 'Menu').trim() || 'Menu';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries()).map(([category, rows]) => ({ category, rows }));
}

function termText(t: string | { text?: string; clause?: string }): string {
  if (typeof t === 'string') return t;
  return String(t.text || t.clause || '');
}

function statusBadgeStyle(status: string): CSSProperties {
  const u = status.toUpperCase();
  if (u === 'ACCEPTED')
    return {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac',
    };
  if (u === 'SENT' || u === 'PENDING')
    return {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fcd34d',
    };
  return {
    background: '#f4f4f5',
    color: '#52525b',
    border: '1px solid #d4d4d8',
  };
}

function statusLabel(status: string): string {
  const u = status.toUpperCase();
  if (u === 'ACCEPTED') return 'Accepted';
  if (u === 'SENT') return 'Pending';
  if (u === 'DRAFT') return 'Draft';
  return status.replace(/_/g, ' ') || '—';
}

export default function QuotePublicPage({ quote, token, error }: PageProps) {
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const snap: TemplateSnapshot = useMemo(
    () => (quote?.template_snapshot || {}) as TemplateSnapshot,
    [quote?.template_snapshot],
  );

  const primary = snap.primary_color || '#1a6b4a';

  const handleAccept = useCallback(async () => {
    if (!token || acceptLoading || acceptSuccess) return;
    setAcceptLoading(true);
    setAcceptError(null);
    try {
      const res = await fetch(`${API_BASE}/api/q/${token}/accept/`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
      };
      if (data.status === 'already_accepted' || data.status === 'accepted') {
        setAcceptSuccess(true);
      } else if (!res.ok) {
        setAcceptError('Could not accept quotation. Please try again.');
      } else {
        setAcceptSuccess(true);
      }
    } catch {
      setAcceptError('Network error. Please try again.');
    } finally {
      setAcceptLoading(false);
    }
  }, [token, acceptLoading, acceptSuccess]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          color: '#444',
        }}
      >
        <p>{error}</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          color: '#444',
        }}
      >
        <p>Quote not found</p>
      </div>
    );
  }

  const businessName = snap.business_name || 'Catering';
  const showTerms =
    Array.isArray(snap.terms_clauses) && snap.terms_clauses.length > 0;
  const pricingStyle = (snap.pricing_style || 'simple_total') as PricingStyle;
  const pd = quote.pricing_data || {};
  const menuTotal = parseNum(pd.menu_total);
  const finalSelling = parseNum(pd.final_selling_price ?? pd.selling_price) ||
    parseNum(quote.final_selling_price);
  const totalAmt = parseNum(quote.total_amount);
  const subtotal = menuTotal || totalAmt || finalSelling;
  const taxPct = Number(snap.tax_percent ?? 0);
  const advancePct = Number(snap.advance_percent ?? 0);
  const taxAmt = subtotal * (taxPct / 100);
  const totalWithTax = subtotal + taxAmt;
  const advanceAmt = parseNum(pd.advance_amount) ||
    (advancePct ? (totalWithTax * advancePct) / 100 : 0);
  const pax = quote.pax ?? 0;
  const perHead = pax > 0 ? finalSelling / pax : 0;

  const alreadyAccepted =
    quote.status.toUpperCase() === 'ACCEPTED' || acceptSuccess;

  return (
    <>
      <Head>
        <title>
          {quote.quote_number ? `Quote ${quote.quote_number}` : 'Quotation'} —{' '}
          {businessName}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div
        style={
          {
            ['--primary' as string]: primary,
            minHeight: '100vh',
            background: '#f4f4f5',
            fontFamily:
              snap.font_family ||
              'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            color: '#18181b',
          } as CSSProperties
        }
      >
        {/* HEADER BAR */}
        <header
          style={{
            background: primary,
            color: '#fff',
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              maxWidth: 680,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {snap.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={snap.logo_url}
                alt=""
                style={{
                  maxHeight: 48,
                  maxWidth: 120,
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: 4,
                }}
              />
            ) : (
              <span style={{ fontWeight: 700, fontSize: 18 }}>{businessName}</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {snap.logo_url ? (
                <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.25 }}>
                  {businessName}
                </div>
              ) : null}
              {snap.tagline ? (
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.95,
                    marginTop: 4,
                    lineHeight: 1.35,
                  }}
                >
                  {snap.tagline}
                </div>
              ) : null}
              {snap.phone ? (
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
                  {snap.phone}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main
          style={{
            maxWidth: 680,
            margin: '0 auto',
            padding: '18px 16px 32px',
            boxSizing: 'border-box',
          }}
        >
          {/* QUOTE INFO CARD */}
          <section
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '18px 16px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#71717a',
                    marginBottom: 4,
                  }}
                >
                  Quote
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {quote.quote_number}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 999,
                  ...statusBadgeStyle(quote.status),
                }}
              >
                {statusLabel(quote.status)}
              </span>
            </div>
            <dl
              style={{
                margin: '16px 0 0',
                display: 'grid',
                gap: 10,
                fontSize: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: '#71717a', margin: 0 }}>Customer</dt>
                <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>
                  {quote.customer_name || '—'}
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: '#71717a', margin: 0 }}>Event date</dt>
                <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>
                  {quote.event_date || '—'}
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: '#71717a', margin: 0 }}>Venue</dt>
                <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>
                  {quote.venue || '—'}
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <dt style={{ color: '#71717a', margin: 0 }}>Guests (pax)</dt>
                <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>
                  {quote.pax != null ? quote.pax : '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* MENU SECTION */}
          {quote.line_items && quote.line_items.length > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  margin: '0 0 12px',
                  color: primary,
                }}
              >
                Menu
              </h2>
              {groupedLineItems(quote.line_items).map((group) => (
                <div key={group.category} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 8,
                      borderBottom: `2px solid ${primary}`,
                      paddingBottom: 4,
                    }}
                  >
                    {group.category}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {group.rows.map((item, idx) => (
                      <li
                        key={`${group.category}-${idx}-${lineTitle(item)}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 0',
                          borderBottom: '1px solid #e4e4e7',
                          fontSize: 14,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span>{lineTitle(item)}</span>
                          {isCompliment(item) ? (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 10,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                color: '#16a34a',
                                background: '#dcfce7',
                                padding: '2px 6px',
                                borderRadius: 4,
                                verticalAlign: 'middle',
                              }}
                            >
                              Compliment
                            </span>
                          ) : null}
                        </div>
                        <span
                          style={{
                            color: '#52525b',
                            whiteSpace: 'nowrap',
                            fontSize: 13,
                          }}
                        >
                          {lineQty(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}

          {/* PRICING SECTION */}
          <section
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '16px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
              marginBottom: 20,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
              Pricing
            </h2>
            {pricingStyle === 'tax_table' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e4e7' }}>
                      Subtotal
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #e4e4e7',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {fmtINR(subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e4e7' }}>
                      Tax ({taxPct}%)
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #e4e4e7',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {fmtINR(taxAmt)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e4e7' }}>
                      Advance
                      {advancePct ? ` (${advancePct}%)` : ''}
                    </td>
                    <td
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #e4e4e7',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {fmtINR(advanceAmt)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 0 0', fontWeight: 700 }}>Total</td>
                    <td style={{ padding: '10px 0 0', textAlign: 'right', fontWeight: 700 }}>
                      {fmtINR(parseNum(pd.final_selling_price) || finalSelling || totalWithTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : pricingStyle === 'per_head' ? (
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Per guest (est.)</span>
                  <strong>{fmtINR(perHead)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span>Guests</span>
                  <strong>{pax || '—'}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '2px solid #e4e4e7',
                    fontWeight: 700,
                  }}
                >
                  <span>Total</span>
                  <span>{fmtINR(finalSelling)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                Total: {fmtINR(finalSelling || parseNum(quote.total_amount))}
              </div>
            )}
          </section>

          {/* TERMS */}
          {showTerms ? (
            <section style={{ marginBottom: 20 }}>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: '#52525b',
                  lineHeight: 1.55,
                }}
              >
                {snap.terms_clauses!.map((c, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    {termText(c)}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* ACCEPT */}
          {alreadyAccepted ? (
            <div
              role="status"
              style={{
                background: '#dcfce7',
                color: '#166534',
                padding: '14px 16px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 20,
                border: '1px solid #86efac',
              }}
            >
              {quote.status.toUpperCase() === 'ACCEPTED' && !acceptSuccess
                ? 'This quotation has already been accepted.'
                : `Quotation accepted! ${businessName} will contact you shortly.`}
            </div>
          ) : (
            <>
              {acceptError ? (
                <div
                  style={{
                    background: '#fee2e2',
                    color: '#991b1b',
                    padding: '12px 14px',
                    borderRadius: 8,
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  {acceptError}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleAccept}
                disabled={acceptLoading}
                style={{
                  width: '100%',
                  padding: '16px 18px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#fff',
                  background: acceptLoading ? '#86efac' : '#16a34a',
                  border: 'none',
                  borderRadius: 10,
                  cursor: acceptLoading ? 'wait' : 'pointer',
                  marginBottom: 20,
                  boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                }}
              >
                {acceptLoading ? 'Submitting…' : 'Accept this quotation'}
              </button>
            </>
          )}
        </main>

        <footer
          style={{
            textAlign: 'center',
            padding: '20px 16px 28px',
            fontSize: 12,
            color: '#71717a',
          }}
        >
          {snap.footer_text ? (
            <p style={{ margin: '0 0 8px', maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
              {snap.footer_text}
            </p>
          ) : null}
          <p style={{ margin: 0, fontSize: 11, color: '#a1a1aa' }}>
            Powered by CateringOS
          </p>
        </footer>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const raw = ctx.params?.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || typeof token !== 'string') {
    return { props: { quote: null, token: '' } };
  }

  try {
    const res = await fetch(`${API_BASE}/api/q/${encodeURIComponent(token)}/`, {
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) {
      return { props: { quote: null, token } };
    }

    if (!res.ok) {
      return {
        props: {
          quote: null,
          token,
          error: 'Unable to load quotation.',
        },
      };
    }

    const quote = (await res.json()) as QuotePublicPayload;
    return { props: { quote, token } };
  } catch {
    return {
      props: {
        quote: null,
        token,
        error: 'Unable to load quotation.',
      },
    };
  }
};
