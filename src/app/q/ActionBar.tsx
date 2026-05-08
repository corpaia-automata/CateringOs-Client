'use client';

import { useState } from 'react';

import { getApiBaseUrl } from '@/src/lib/api/client';

interface ActionBarProps {
  token: string;
  isPrint?: boolean;
}

/**
 * Fixed bottom action bar for public quotation links.
 */
export function ActionBar({ token, isPrint = false }: ActionBarProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (isPrint) {
    return null;
  }

  const setTimedMessage = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(null), 3000);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setTimedMessage('Link copied');
    } catch {
      setTimedMessage('Copy failed');
    }
  };

  const pollForPdfUrl = async (maxAttempts = 16) => {
    const base = getApiBaseUrl();
    const url = `${base}/api/q/${encodeURIComponent(token)}/`;

    for (let i = 0; i < maxAttempts; i += 1) {
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const payload = (await response.json()) as {
        quotation?: { pdf_url?: string | null };
      };
      const pdfUrl = payload?.quotation?.pdf_url;
      if (pdfUrl && String(pdfUrl).trim()) {
        return pdfUrl;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }

    return null;
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setMessage(null);
    try {
      const base = getApiBaseUrl();
      const url = `${base}/api/q/${encodeURIComponent(token)}/generate-pdf/`;
      const response = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const payload = (await response.json()) as { status?: string; pdf_url?: string };
      const immediateUrl = payload?.pdf_url;
      if (immediateUrl) {
        window.open(immediateUrl, '_blank', 'noopener,noreferrer');
        setTimedMessage('PDF ready');
        return;
      }

      const finalPdf = await pollForPdfUrl();
      if (finalPdf) {
        window.open(finalPdf, '_blank', 'noopener,noreferrer');
        setTimedMessage('PDF ready');
      } else {
        setTimedMessage('PDF is still processing');
      }
    } catch {
      setTimedMessage('Could not generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="q-action-bar" role="region" aria-label="Quotation actions">
      <button
        type="button"
        className="q-action-bar__button"
        onClick={handleDownloadPdf}
        disabled={isDownloading}
      >
        {isDownloading ? 'Generating PDF...' : 'Download PDF'}
      </button>
      <button type="button" className="q-action-bar__button q-action-bar__button--secondary" onClick={handleCopyLink}>
        Copy Link
      </button>
      {message ? <span className="q-action-bar__message">{message}</span> : null}
    </div>
  );
}
