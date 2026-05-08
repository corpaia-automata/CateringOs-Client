'use client';

import { Plus, Trash2, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ServiceItem } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

type UpdateableField = 'service_name' | 'description';

interface Props {
  services:        ServiceItem[];
  onAddService:    () => void;
  onUpdateService: (key: string, field: UpdateableField, value: string) => void;
  onRemoveService: (key: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServicesList({
  services,
  onAddService,
  onUpdateService,
  onRemoveService,
}: Props) {
  return (
    <Card>
      <CardHeader className="border-b pb-3.5 flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Additional Services</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddService}
          className="gap-1.5 text-xs shrink-0"
        >
          <Plus size={13} />
          Add Service
        </Button>
      </CardHeader>

      <CardContent className="pt-4">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center select-none">
            <Wrench size={22} className="text-muted-foreground/25 mb-2" aria-hidden />
            <p className="text-sm text-muted-foreground/70">No services added</p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Click &ldquo;Add Service&rdquo; to include extras like décor, photography, etc.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-0.5">
              <span className="text-[10px] text-muted-foreground/70">Service Name</span>
              <span className="text-[10px] text-muted-foreground/70">Description</span>
              <span className="w-[22px]" aria-hidden />
            </div>

            {/* Service rows */}
            {services.map((service) => (
              <div key={service._key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start group/row">
                <Input
                  value={service.service_name}
                  onChange={(e) => onUpdateService(service._key, 'service_name', e.target.value)}
                  placeholder="e.g. Photography"
                  className="h-8 text-sm"
                />
                <Input
                  value={service.description}
                  onChange={(e) => onUpdateService(service._key, 'description', e.target.value)}
                  placeholder="Optional description"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveService(service._key)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
                  title="Remove service"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
