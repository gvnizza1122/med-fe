'use client';
// Kartu utama halaman Hasil Validasi: semua alasan klaim bisa dipending dalam
// SATU daftar, urut dari yang paling berat. Sumbernya berbeda-beda (aturan
// validasi, analisis AI, pola pending, bukti kode) dan disusun induknya;
// kartu ini hanya mengurutkan dan menampilkan. Tidak mengubah data klaim.
import { AlertCircle, AlertTriangle, CheckCircle2, CircleAlert, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type Keparahan = 'berat' | 'sedang' | 'ringan';
export type BagianDetail = 'kode' | 'bukti' | 'fisik' | 'agen' | 'semua';

export interface ItemAlasan {
  id: string;
  judul: string;
  rincian?: string[];
  sumber: string;
  keparahan: Keparahan;
  halaman?: number | null;
  bukti?: string | null;
  tindakan?: string | null;
  buka?: { bagian: BagianDetail; label: string };
}

const URUTAN: Record<Keparahan, number> = { berat: 0, sedang: 1, ringan: 2 };
const IKON: Record<Keparahan, { ikon: typeof AlertCircle; kelas: string; label: string }> = {
  berat: { ikon: CircleAlert, kelas: 'text-red-600 dark:text-red-400', label: 'Berat' },
  sedang: { ikon: AlertTriangle, kelas: 'text-amber-600 dark:text-amber-400', label: 'Perlu dicek' },
  ringan: { ikon: AlertCircle, kelas: 'text-muted-foreground', label: 'Ringan' },
};

export function AlasanPendingCard({
  items, analisisTersedia, catatanKelengkapan, tindakanTerbaca, keandalan, onBuka, onOpenPdf,
}: {
  items: ItemAlasan[];
  analisisTersedia: boolean;
  catatanKelengkapan: string[];
  tindakanTerbaca: string[];
  keandalan?: string | null;
  onBuka: (bagian: BagianDetail) => void;
  onOpenPdf?: (halaman: number) => void;
}) {
  const urut = [...items].sort((a, b) => URUTAN[a.keparahan] - URUTAN[b.keparahan]);
  const jumlahBerat = urut.filter(i => i.keparahan === 'berat').length;
  const bersih = urut.length === 0;

  return (
    <Card className={cn('gap-0 p-0', bersih ? 'border-emerald-500/40' : jumlahBerat ? 'border-red-300 dark:border-red-500/40' : 'border-amber-500/40')}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pb-3 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
          {bersih
            ? <><CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600 dark:text-emerald-400" /> Tidak ditemukan alasan pending</>
            : <><AlertTriangle aria-hidden="true" className={cn('size-5', jumlahBerat ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} /> {urut.length} alasan klaim ini bisa dipending</>}
        </h2>
        {jumlahBerat > 0 && (
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-300">{jumlahBerat} berat</span>
        )}
      </div>

      {catatanKelengkapan.length > 0 && (
        <div role="alert" className="mx-4 mb-3 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10 sm:mx-5">
          <p className="font-semibold text-amber-900 dark:text-amber-300">Analisis belum lengkap · persetujuan ditahan</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground/85">{catatanKelengkapan.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      {!analisisTersedia && (
        <p className="mx-4 mb-3 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground sm:mx-5">
          Analisis AI untuk klaim ini gagal dibuat saat unggah, jadi daftar di bawah hanya dari pemeriksaan aturan. Klik &ldquo;Baca ulang&rdquo; untuk mencoba lagi.
        </p>
      )}

      {bersih ? (
        <p className="px-4 pb-4 text-sm leading-relaxed text-foreground/85 sm:px-5">
          Pemeriksaan aplikasi tidak menemukan alasan yang biasa membuat klaim dipending. Tetap cocokkan data dengan dokumen asli sebelum klaim dikirim.
        </p>
      ) : (
        <ol className="border-t border-border">
          {urut.map(item => {
            const k = IKON[item.keparahan];
            const Ikon = k.ikon;
            return (
              <li key={item.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 border-b border-border px-4 py-3 last:border-0 sm:px-5">
                <Ikon aria-label={k.label} className={cn('mt-0.5 size-5', k.kelas)} />
                <div className="min-w-0">
                  <p className="break-words font-medium leading-snug text-foreground">{item.judul}</p>
                  {item.rincian && item.rincian.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-foreground/80">
                      {item.rincian.map((r, i) => <li key={i} className="break-words">{r}</li>)}
                    </ul>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.sumber}
                    {item.bukti && <> · <span className="italic">{item.bukti}</span></>}
                  </p>
                  {item.tindakan && <p className="mt-1 text-sm text-foreground"><span className="text-muted-foreground">Lakukan:</span> {item.tindakan}</p>}
                  {((item.halaman && onOpenPdf) || item.buka) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.halaman && onOpenPdf && (
                        <button type="button" onClick={() => onOpenPdf(item.halaman!)}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted">
                          <FileText aria-hidden="true" className="size-3.5" /> Lihat bukti hal. {item.halaman}
                        </button>
                      )}
                      {item.buka && (
                        <button type="button" onClick={() => onBuka(item.buka!.bagian)}
                          className="inline-flex min-h-8 items-center rounded-md border border-primary/30 bg-primary/5 px-2.5 text-xs font-medium text-primary hover:bg-primary/10">
                          {item.buka.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {(tindakanTerbaca.length > 0 || keandalan) && (
        <div className="space-y-1 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {tindakanTerbaca.length > 0 && <p>Tindakan terbaca: {tindakanTerbaca.join(' · ')}</p>}
          {keandalan && <p>{keandalan}</p>}
        </div>
      )}
    </Card>
  );
}
