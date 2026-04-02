import * as XLSX from 'xlsx';

export interface ExportRow {
  client_name?: string;
  event_date?: string;
  venue?: string;
  service_type?: string;
  guest_count?: number;
  total_amount?: string | number;
  advance_amount?: string | number;
  pending?: number | null;
  status?: string;
  payment_status?: string;
}

const SERVICE_LABELS: Record<string, string> = {
  BUFFET:        'Buffet',
  BOX_COUNTER:   'Box Counter',
  TABLE_SERVICE: 'Table Service',
  OTHER:         'Other',
};

function fmtAmt(v?: string | number | null): string {
  if (v == null || v === '') return '';
  const n = parseFloat(String(v));
  return isNaN(n) ? '' : String(n);
}

export function exportEventsToExcel(rows: ExportRow[], filename: string) {
  const headers = [
    'Client Name', 'Event Date', 'Venue', 'Service Type',
    'Guests', 'Total (₹)', 'Paid (₹)', 'Pending (₹)', 'Status', 'Payment Status',
  ];

  const data = rows.map(ev => {
    const total = ev.total_amount != null ? parseFloat(String(ev.total_amount)) : null;
    const paid  = ev.advance_amount != null ? parseFloat(String(ev.advance_amount)) : 0;
    const pending = total != null ? total - paid : null;

    return [
      ev.client_name ?? '',
      ev.event_date ?? '',
      ev.venue ?? '',
      SERVICE_LABELS[ev.service_type ?? ''] ?? ev.service_type ?? '',
      ev.guest_count ?? '',
      fmtAmt(ev.total_amount),
      fmtAmt(ev.advance_amount),
      pending != null ? String(pending) : '',
      ev.status ?? '',
      ev.payment_status ?? '',
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  worksheet['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
    { wch: 8 },  { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');
  XLSX.writeFile(workbook, filename);
}
