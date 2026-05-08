import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';

import { authStorage } from '@/lib/auth';

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

export type TemplateListRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  business_name: string;
  is_active: boolean;
  setup_fee_paid: boolean;
  updated_at: string;
};

type PageProps = {
  templates: TemplateListRow[];
};

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const needle = `${name}=`;
  const segments = cookieHeader.split(';').map((s) => s.trim());
  for (const seg of segments) {
    if (seg.startsWith(needle)) {
      return decodeURIComponent(seg.slice(needle.length));
    }
  }
  return null;
}

function getAccessTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  return (
    readCookie(cookieHeader, 'cos_access') ?? readCookie(cookieHeader, 'access_token')
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      Inactive
    </span>
  );
}

export default function AdminTemplatesIndex({ templates }: PageProps) {
  const router = useRouter();
  const token = authStorage.getAccess();

  const [cloneForId, setCloneForId] = useState<string | null>(null);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);
  const [cloneErr, setCloneErr] = useState('');

  const sorted = useMemo(
    () =>
      [...templates].sort(
        (a, b) =>
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime(),
      ),
    [templates],
  );

  async function submitClone() {
    const tid = targetTenantId.trim();
    if (!cloneForId || !tid || !token) {
      setCloneErr('Enter a target tenant UUID.');
      return;
    }
    setCloneErr('');
    setCloneBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/quotations/templates/${cloneForId}/clone/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_tenant_id: tid }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; detail?: string };
      if (!res.ok) {
        setCloneErr(typeof body.detail === 'string' ? body.detail : `Clone failed (${res.status})`);
        setCloneBusy(false);
        return;
      }
      const newId = body.id;
      if (newId) {
        void router.push(`/admin/templates/${newId}`);
        return;
      }
      setCloneErr('Unexpected response.');
    } catch {
      setCloneErr('Network error.');
    } finally {
      setCloneBusy(false);
    }
  }

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <Head>
        <title>Quotation templates · Admin</title>
      </Head>

      <div className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-[#e2e8f0] bg-white px-6 py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
                Quotation templates
              </h1>
              <p className="mt-1 text-sm text-[#64748b]">
                Configure branding and layout for each client.
              </p>
            </div>
            <Link
              href="/admin/templates/new"
              className="inline-flex shrink-0 items-center rounded-lg bg-[#1C3355] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162a47]"
            >
              Add new template
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <th className="px-4 py-3 font-semibold text-[#475569]">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-[#475569]">Business name</th>
                  <th className="px-4 py-3 font-semibold text-[#475569]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[#475569]">Last updated</th>
                  <th className="px-4 py-3 font-semibold text-[#475569] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="px-4 py-3 font-medium text-[#0f172a]">{row.tenant_name}</td>
                    <td className="px-4 py-3 text-[#334155]">{row.business_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={row.is_active} />
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{fmtDate(row.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/templates/${row.id}`}
                          className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0f172a] hover:bg-[#f8fafc]"
                        >
                          Edit template
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setCloneForId(row.id);
                            setTargetTenantId('');
                            setCloneErr('');
                          }}
                          className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1C3355] hover:bg-[#f1f5f9]"
                        >
                          Clone
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[#64748b]">No templates yet.</p>
            ) : null}
          </div>
        </main>
      </div>

      {cloneForId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clone-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <h2 id="clone-dialog-title" className="text-lg font-semibold text-[#0f172a]">
              Clone to which tenant?
            </h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Enter the target tenant UUID (workspace without an existing quotation template). Staff-only API applies.
            </p>
            <input
              type="text"
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="mt-4 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 font-mono text-sm text-[#0f172a] outline-none focus:border-[#1C3355]"
            />
            {cloneErr ? (
              <p className="mt-2 text-sm text-red-600">{cloneErr}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f8fafc]"
                onClick={() => setCloneForId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cloneBusy}
                className="rounded-lg bg-[#1C3355] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void submitClone()}
              >
                {cloneBusy ? 'Cloning…' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = getAccessTokenFromCookieHeader(ctx.req.headers.cookie);
  if (!token) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }

  const res = await fetch(`${API_BASE}/api/quotations/templates/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }

  const raw = (await res.json()) as unknown;
  const templates = Array.isArray(raw)
    ? (raw as TemplateListRow[])
    : [];

  return {
    props: {
      templates,
    },
  };
};
