'use client';

import { useCallback, useState } from 'react';

import { exportQuotationPdfBlob } from '@/lib/api/quotations';

export interface QuotationPdfDownloadButtonProps {
  quotationId: string;
  tenantSlug: string;
}

export function QuotationPdfDownloadButton({
  quotationId,
  tenantSlug,
}: QuotationPdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('cos_access') ?? '' : '';
      if (!token) {
        setError('Not signed in.');
        return;
      }
      const { blob, filename } = await exportQuotationPdfBlob(quotationId, {
        accessToken: token,
        tenantSlug,
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
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }, [quotationId, tenantSlug]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading || !tenantSlug}
        style={{
          padding: '10px 18px',
          borderRadius: 6,
          border: '1px solid #1a1a1a',
          background: loading ? '#ccc' : '#1a1a1a',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading || !tenantSlug ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Generating…' : 'Download PDF'}
      </button>
      {error ? (
        <span style={{ fontSize: 12, color: '#b91c1c', maxWidth: 280, textAlign: 'right' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
