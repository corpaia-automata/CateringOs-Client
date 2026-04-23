'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  dishId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function BulkUploadModal({ dishId, onClose, onSaved }: Props) {
  const qc = useQueryClient();

  const [file, setFile]           = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Only .xlsx or .xls files accepted');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File too large — max 5 MB');
      return;
    }
    setFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.upload(`/master/dishes/${dishId}/recipe/upload/`, form);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['recipe', dishId] }),
        qc.invalidateQueries({ queryKey: ['dish',   dishId] }),
      ]);
      toast.success('Recipe uploaded');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const raw = (err as { data?: unknown })?.data;
      const msg =
        (raw as { detail?: string })?.detail ||
        (raw && typeof raw === 'object'
          ? Object.values(raw as Record<string, unknown>).flat().filter(Boolean).join(', ')
          : '') ||
        'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Upload Recipe</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {file ? (
              <>
                <FileSpreadsheet size={28} className="text-green-500" />
                <p className="text-sm font-medium text-gray-800">{file.name}</p>
                <p className="text-xs text-gray-400">Click to replace</p>
              </>
            ) : (
              <>
                <UploadCloud size={28} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-700">Click to select .xlsx file</p>
                <p className="text-xs text-gray-400">
                  Columns:{' '}
                  <span className="font-mono">ingredient_name</span>,{' '}
                  <span className="font-mono">quantity</span>,{' '}
                  <span className="font-mono">unit</span>
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleSelect}
            />
          </div>

          {/* Format hint */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Expected format:</p>
            <table className="w-full text-xs text-gray-500">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left pb-1.5 font-mono font-normal pr-4">ingredient_name</th>
                  <th className="text-left pb-1.5 font-mono font-normal pr-4">quantity</th>
                  <th className="text-left pb-1.5 font-mono font-normal">unit</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr>
                  <td className="py-0.5 pr-4">Chicken</td>
                  <td className="py-0.5 pr-4">0.5</td>
                  <td className="py-0.5">kg</td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-4">Onion</td>
                  <td className="py-0.5 pr-4">2</td>
                  <td className="py-0.5">piece</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              New ingredients are created automatically.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 rounded-lg bg-gray-900 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : 'Upload & Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
