'use client';
import * as React from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  /** Nilai tanggal dalam format ISO (YYYY-MM-DD), sama seperti <input type="date"> — supaya drop-in ganti tanpa ubah state parent. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** ISO string — batas minimum/maksimum tanggal yang boleh dipilih. */
  min?: string;
  max?: string;
}

function parseIso(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePicker({ value, onChange, placeholder = 'Pilih tanggal', className, min, max }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseIso(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">
            {selected ? format(selected, 'd MMM yyyy', { locale: localeId }) : placeholder}
          </span>
          {selected && (
            <X
              className="size-3.5 shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={localeId}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => { onChange(date ? toIso(date) : ''); setOpen(false); }}
          disabled={(date) => {
            const min_ = parseIso(min);
            const max_ = parseIso(max);
            if (min_ && date < min_) return true;
            if (max_ && date > max_) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
