'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DraftCategory, DraftItem } from './types';

interface Props {
  category: DraftCategory;
  onAddRow: (categoryId: string) => void;
  onUpdateItem: (categoryId: string, key: string, field: keyof DraftItem, value: string) => void;
  onRemoveItem: (categoryId: string, key: string) => void;
  onSaveItem: (categoryId: string, key: string) => void;
}

const UNITS = ['Kg', 'Litre', 'Nos', 'Pax', 'Plate', 'Box', 'Bag', 'Hr'];

export default function CategoryAccordion({
  category,
  onAddRow,
  onUpdateItem,
  onRemoveItem,
  onSaveItem,
}: Props) {
  const subtotal = category.items.reduce(
    (sum, item) => sum + (parseFloat(item.total) || 0),
    0
  );

  return (
    <AccordionItem value={category.id}>
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex w-full items-center justify-between pr-4">
          <span className="font-medium text-sm">{category.name}</span>
          <span className="text-sm text-muted-foreground">
            ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-2 font-medium w-[35%]">Item</th>
              <th className="text-right py-2 font-medium w-[12%]">Qty</th>
              <th className="text-left py-2 font-medium w-[12%] pl-2">Unit</th>
              <th className="text-right py-2 font-medium w-[18%]">Rate (₹)</th>
              <th className="text-right py-2 font-medium w-[18%]">Total (₹)</th>
              <th className="w-[5%]" />
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => (
              <tr key={item._key} className="border-b last:border-0 group">
                <td className="py-1 pr-2">
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      onUpdateItem(category.id, item._key, 'name', e.target.value)
                    }
                    onBlur={() => item.id && onSaveItem(category.id, item._key)}
                    placeholder="Item name"
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItem(category.id, item._key, 'quantity', e.target.value)
                    }
                    onBlur={() => item.id && onSaveItem(category.id, item._key)}
                    className="h-8 text-sm text-right"
                  />
                </td>
                <td className="py-1 pr-2 pl-2">
                  <select
                    value={item.unit}
                    onChange={(e) =>
                      onUpdateItem(category.id, item._key, 'unit', e.target.value)
                    }
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) =>
                      onUpdateItem(category.id, item._key, 'rate', e.target.value)
                    }
                    onBlur={() => item.id && onSaveItem(category.id, item._key)}
                    className="h-8 text-sm text-right"
                  />
                </td>
                <td className="py-1 text-right text-muted-foreground">
                  {(parseFloat(item.total) || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="py-1 pl-2">
                  <button
                    onClick={() => onRemoveItem(category.id, item._key)}
                    className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-muted-foreground"
          onClick={() => onAddRow(category.id)}
        >
          <Plus size={14} className="mr-1" /> Add Row
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}
