'use client';
// Referensi statis (BUKAN dari API, bukan saran AI) — tabel padanan kode
// "nyeri saja" ke kode yang lebih spesifik/akut, dari BA 1247/2024. Sengaja
// TIDAK ada tombol "Terapkan" seperti suggestedCodes: tabel ini pengetahuan
// umum ICD-10, bukan bukti dari dokumen klaim ini — koder yang harus baca
// kondisi klinis sendiri sebelum ganti kode, sistem tidak boleh menebak.
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PADANAN_KODE = [
  { dari: 'R10.9', deskripsi: 'Unspecified abdominal pain', ke: 'R10.0 – Acute abdomen', syarat: 'Ada rigidity, defense muscular, atau nyeri onset tiba-tiba' },
  { dari: 'R52', deskripsi: 'Unspecified pain', ke: 'Kode spesifik organ (R10.x, M54.x, dll)', syarat: 'Lokasi nyeri sudah diketahui dari dokumen' },
  { dari: 'R07.9', deskripsi: 'Chest pain unspecified', ke: 'R07.4 + EKG, atau I20.0 (angina instabil)', syarat: 'Ada perubahan EKG atau riwayat jantung' },
  { dari: 'G43.9', deskripsi: 'Migraine unspecified', ke: 'Tetap G43.x + tambahkan R51 jika onset pertama', syarat: 'Pastikan bukan perdarahan subarachnoid (G93.1)' },
  { dari: 'M54.5', deskripsi: 'Low back pain', ke: 'M54.4 (lumbago with sciatica) atau M51.1 (hernia disc)', syarat: 'Ada radikulopati atau defisit neurologis' },
];

export function PadananKodeNyeriCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/50"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Referensi: Padanan Kode Nyeri → Kode Lebih Spesifik (baca saja, bukan otomatis)
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Kode Saat Ini</th>
                <th className="px-3 py-2 text-left font-semibold">Deskripsi</th>
                <th className="px-3 py-2 text-left font-semibold">Kode Lebih Tepat</th>
                <th className="px-3 py-2 text-left font-semibold">Syarat Upgrade</th>
              </tr>
            </thead>
            <tbody>
              {PADANAN_KODE.map((row, i) => (
                <tr key={row.dari} className={cn('border-t border-border', i % 2 === 1 && 'bg-muted/20')}>
                  <td className="px-3 py-2 font-mono">{row.dari}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.deskripsi}</td>
                  <td className="px-3 py-2 font-mono">{row.ke}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.syarat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
