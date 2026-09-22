'use client';
// Ketentuan Klaim per Diagnosis — Tipe 3 (aturan kombinasi kode).
//
// Sumber aturan: catatan casemix RS Lestari Raharja + Berita Acara Kesepakatan
// Kemenkes-BPJS No. JP.02.03/3/2411/2018 & 620/BA/1118. Backend yang
// mengevaluasi (ketentuanKlaimService.js); kartu ini hanya menampilkan.
//
// Kartu ini MELAPORKAN, tidak memutuskan — penetapan kode tetap wewenang
// koder, jadi tidak ada tombol yang mengubah data di sini.
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TemuanKombinasiKode {
  kode: string;
  nama: string;
  aksi: 'buang_pasangan' | 'ganti_gabungan' | 'cukup_utama' | string;
  pesan: string;
  kode_utama: string[];
  kode_terdampak: string[];
  kode_gabungan: string | null;
  sumber: 'casemix_rs' | 'ba_2018' | 'keduanya' | string;
  kutipan_sumber: string;
}

// Aturan ber-dasar Berita Acara bisa dikutip lengkap saat berargumen dengan
// verifikator — itu dokumen yang ditandatangani Kemenkes dan BPJS. Aturan dari
// catatan casemix RS lebih lemah posisinya, jadi bedanya ditampilkan.
const LABEL_SUMBER: Record<string, string> = {
  casemix_rs: 'Casemix RS',
  ba_2018: 'Berita Acara 2018',
  keduanya: 'BA 2018 + Casemix RS',
};

export function KetentuanKlaimCard({ temuan }: { temuan?: TemuanKombinasiKode[] | null }) {
  if (!temuan || temuan.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Ketentuan Klaim — Kombinasi Kode</h3>
        <span className="text-[11px] text-muted-foreground">
          {temuan.length} aturan terpicu · penetapan kode tetap oleh koder
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {temuan.map(t => (
          <div
            key={t.kode}
            className="rounded-lg border border-amber-900/30 bg-amber-950/20 px-3.5 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-amber-500">{t.kode}</span>
              <span className="text-sm font-medium text-foreground">{t.nama}</span>
              <Badge
                variant="outline"
                className={cn(
                  'ml-auto text-[10px]',
                  t.sumber === 'casemix_rs'
                    ? 'border-blue-500/40 text-blue-500 dark:text-blue-400'
                    : 'border-violet-500/40 text-violet-500 dark:text-violet-400',
                )}
                title={t.kutipan_sumber}
              >
                {LABEL_SUMBER[t.sumber] || t.sumber}
              </Badge>
            </div>

            <p className="mt-1 text-xs leading-snug text-muted-foreground">{t.pesan}</p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Kode terdampak:</span>
              {t.kode_terdampak.map(k => (
                <span
                  key={k}
                  className="rounded bg-amber-950/50 px-1.5 py-0.5 font-mono text-amber-400 line-through"
                >
                  {k}
                </span>
              ))}
              {t.aksi === 'ganti_gabungan' && t.kode_gabungan && (
                <>
                  <span className="text-muted-foreground">diganti</span>
                  <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 font-mono text-emerald-400">
                    {t.kode_gabungan}
                  </span>
                </>
              )}
            </div>

            <p className="mt-1.5 text-[10px] italic leading-snug text-muted-foreground/70">
              &ldquo;{t.kutipan_sumber}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
