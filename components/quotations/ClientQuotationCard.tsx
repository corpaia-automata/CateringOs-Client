'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Download, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportQuotationPdfBlob } from '@/lib/api/quotations';
import { authStorage } from '@/lib/auth';
import type { ClientQuotationGroup } from '@/lib/groupQuotationsByClient';
import type { QuotationUiStatus } from '@/lib/quotationsRevisions';

// ── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function rupee(n: number): string {
  return '₹ ' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtEventDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtRevDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const time = d
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
  return `${day} ${month}, ${time}`;
}

const AVATAR_COLORS: Record<QuotationUiStatus, { bg: string; color: string }> = {
  Sent:     { bg: '#e3f2fd', color: '#1565c0' },
  Accepted: { bg: '#e8f5e9', color: '#2e7d32' },
  Draft:    { bg: '#f5f5f5', color: '#737373' },
  Declined: { bg: '#ffebee', color: '#c62828' },
};

const BADGE_COLORS: Record<QuotationUiStatus, { bg: string; color: string }> = {
  Sent:     { bg: '#e3f2fd', color: '#1565c0' },
  Accepted: { bg: '#e8f5e9', color: '#2e7d32' },
  Draft:    { bg: '#fff8e1', color: '#f59e0b' },
  Declined: { bg: '#ffebee', color: '#c62828' },
};

function StatusBadge({ status }: { status: QuotationUiStatus }) {
  const { bg, color } = BADGE_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export interface ClientQuotationCardProps {
  group: ClientQuotationGroup;
  /** Org slug — used to build detail-page links and the PDF endpoint. */
  slug: string;
  /**
   * Called when "+ Add revision for this client" is clicked.
   * If omitted, falls back to navigating to /quotations/create.
   */
  onAddRevision?: (clientId: string) => void;
}

export function ClientQuotationCard({ group, slug, onAddRevision }: ClientQuotationCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  // Tracks which revision IDs have an in-flight PDF download.
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const avatar = AVATAR_COLORS[group.latest_status];
  const initials = getInitials(group.client_name);

  // Panel renders revisions latest-first; last element of the sorted array is the latest.
  const revisionsDesc = [...group.revisions].reverse();
  const latestRevId = group.revisions[group.revisions.length - 1]?.quotation_id;

  // ── action handlers ──────────────────────────────────────────────────────

  async function handleDownload(quotationId: string) {
    if (downloadingIds.has(quotationId)) return;
    setDownloadingIds((prev) => new Set(prev).add(quotationId));
    try {
      const token = authStorage.getAccess() ?? '';
      if (!token) {
        toast.error('Not signed in — please reload and try again.');
        return;
      }
      const { blob, filename } = await exportQuotationPdfBlob(quotationId, {
        accessToken: token,
        tenantSlug: slug,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(quotationId);
        return next;
      });
    }
  }

  function handleAddRevision() {
    if (onAddRevision) {
      onAddRevision(group.client_id);
    } else {
      router.push(`/app/${slug}/quotations/create`);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        border: `0.5px solid ${expanded ? 'var(--color-border-secondary)' : 'var(--color-border-tertiary)'}`,
        borderRadius: 'var(--border-radius-lg)',
        background: 'var(--color-background-primary)',
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Avatar */}
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: avatar.bg,
            color: avatar.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            letterSpacing: '0.03em',
            userSelect: 'none',
          }}
        >
          {initials}
        </div>

        {/* Name + sub-line */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#0f172a', lineHeight: 1.3 }}>
            {group.client_name}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#737373', lineHeight: 1.5 }}>
            {group.event_name}
            {' · '}
            {fmtEventDate(group.event_date)}
            {' · '}
            {group.revision_count} revision{group.revision_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Amount + label */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
            {rupee(group.latest_amount)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>Latest rev.</p>
        </div>

        {/* Status badge */}
        <StatusBadge status={group.latest_status} />

        {/* Chevron — rotates 180° when expanded */}
        <ChevronDown
          aria-hidden
          style={{
            width: 16,
            height: 16,
            color: '#9ca3af',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/*
        ── Revisions panel ──
        Always rendered; height animates via grid-template-rows 0fr→1fr so the
        border-top (which lives inside the overflow:hidden inner div) also
        appears/disappears as part of the animation rather than flickering.
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.25s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
            {revisionsDesc.length === 0 ? (
              <p style={{ padding: '12px 16px 12px 64px', fontSize: 12, color: '#9ca3af', margin: 0 }}>
                No revisions yet.
              </p>
            ) : (
              revisionsDesc.map((rev, idx) => {
                const isLatest = rev.quotation_id === latestRevId;
                const isLast = idx === revisionsDesc.length - 1;
                const isDownloading = downloadingIds.has(rev.quotation_id);

                return (
                  <div
                    key={rev.quotation_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 16px 10px 64px',
                      borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
                    }}
                  >
                    {/* Rev pill */}
                    <span
                      style={
                        isLatest
                          ? {
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#1565c0',
                              color: '#fff',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }
                          : {
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid #d1d5db',
                              color: '#6b7280',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }
                      }
                    >
                      Rev {rev.revision_number}
                    </span>

                    {/* Description — falls back to event name */}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 80,
                        fontSize: 12,
                        color: '#737373',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {group.event_name}
                    </span>

                    {/* Date */}
                    <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {fmtRevDate(rev.created_at)}
                    </span>

                    {/* Amount */}
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', flexShrink: 0 }}>
                      {rupee(rev.amount)}
                    </span>

                    {/* Actions — column on mobile (<640px), row on sm+ */}
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      {/* View */}
                      <button
                        type="button"
                        onClick={() => router.push(`/app/${slug}/quotations/${rev.quotation_id}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '4px 10px',
                          borderRadius: 'var(--border-radius-md)',
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'transparent',
                          color: '#374151',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Eye style={{ width: 13, height: 13 }} aria-hidden />
                        View
                      </button>

                      {/* Download — filled on latest, outline on older */}
                      <button
                        type="button"
                        disabled={isDownloading}
                        onClick={() => void handleDownload(rev.quotation_id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '4px 10px',
                          borderRadius: 'var(--border-radius-md)',
                          cursor: isDownloading ? 'not-allowed' : 'pointer',
                          opacity: isDownloading ? 0.6 : 1,
                          whiteSpace: 'nowrap',
                          ...(isLatest
                            ? { background: '#1a1a2e', color: '#fff', border: 'none' }
                            : {
                                background: 'transparent',
                                border: '0.5px solid var(--color-border-secondary)',
                                color: '#374151',
                              }),
                        }}
                      >
                        <Download style={{ width: 13, height: 13 }} aria-hidden />
                        {isDownloading ? 'Generating…' : 'Download'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add revision — delegates to parent or falls back to create page */}
            <div style={{ padding: '10px 16px 14px 64px' }}>
              <button
                type="button"
                onClick={handleAddRevision}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--color-text-info)',
                  cursor: 'pointer',
                }}
              >
                + Add revision for this client
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
