'use client';
// Bilah aksi yang menempel di bawah layar: ringkasan siap/tidaknya klaim dan
// tombol keputusan. Induk wajib memberi ruang bawah (pb-28) supaya bilah ini
// tidak menutupi isi terakhir halaman.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function BilahAksiKlaim({ ringkasan, nada, aksi }: {
  ringkasan: ReactNode; nada: 'siap' | 'tunda'; aksi: ReactNode;
}) {
  return (
    <div className="sticky bottom-3 z-20">
      <div className={cn(
        'flex items-center justify-between gap-3 rounded-xl border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:px-4 sm:py-3',
        nada === 'siap' ? 'border-emerald-500/30' : 'border-amber-500/40',
      )}>
        <div role="status" aria-atomic="true" className="min-w-0 text-xs text-foreground sm:text-sm">{ringkasan}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{aksi}</div>
      </div>
    </div>
  );
}
