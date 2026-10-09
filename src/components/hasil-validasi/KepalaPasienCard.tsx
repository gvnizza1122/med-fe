'use client';
// Kepala halaman Hasil Validasi: identitas pasien, status klaim, kolom yang
// perlu diisi manual, dan tombol aksi utama. Hanya menampilkan data yang
// sudah dihitung induknya -- tidak memanggil API sendiri.
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return '?';
  return (kata[0][0] + (kata.length > 1 ? kata[kata.length - 1][0] : '')).toUpperCase();
}

export interface PeringatanKolom { kunci: string; teks: string }

export function KepalaPasienCard({
  nama, status, kategori, sep, mrn, tanggalLahir, umur, dpjp, peringatan, aksi,
}: {
  nama: string;
  status: ReactNode;
  kategori?: { label: string; accent: string } | null;
  sep?: string | null;
  mrn?: string | null;
  tanggalLahir?: string | null;
  umur?: number | null;
  dpjp?: string | null;
  peringatan: PeringatanKolom[];
  aksi: ReactNode;
}) {
  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary sm:size-14 sm:text-lg">
            {inisial(nama || '')}
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold uppercase leading-tight text-foreground sm:text-xl">{nama || '(nama kosong)'}</h2>
              {status}
              {kategori && (
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-medium"
                  style={{ background: `color-mix(in srgb, ${kategori.accent} 12%, transparent)`, color: kategori.accent }}
                >
                  {kategori.label}
                </span>
              )}
            </div>
            <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {sep && <div className="flex gap-1"><dt>SEP</dt><dd className="font-mono-data text-foreground">{sep}</dd></div>}
              <div className="flex gap-1"><dt>No. RM</dt><dd className="font-mono-data text-foreground">{mrn || '-'}</dd></div>
              {tanggalLahir && (
                <div className="flex gap-1">
                  <dt>Tgl. lahir</dt>
                  <dd className="font-mono-data text-foreground">{tanggalLahir}{umur !== null && umur !== undefined && <span className="ml-1 text-muted-foreground">({umur} thn)</span>}</dd>
                </div>
              )}
              {dpjp && <div className="flex gap-1"><dt>DPJP</dt><dd className="text-foreground">{dpjp}</dd></div>}
            </dl>
            {peringatan.length > 0 && (
              <ul aria-label="Kolom yang perlu dilengkapi" className="flex flex-wrap gap-1.5 pt-0.5">
                {peringatan.map(p => (
                  <li key={p.kunci} className="inline-flex items-center gap-1.5 rounded-md border border-amber-600/25 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
                    {p.teks}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 @3xl:max-w-[28rem] @3xl:justify-end">{aksi}</div>
      </div>
    </Card>
  );
}
