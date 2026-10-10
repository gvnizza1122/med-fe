'use client';
/**
 * Pemeriksaan kritis: aplikasi mempertanyakan hasilnya sendiri sebelum klaim
 * diunggah -- potensi rugi RS, risiko upcoding/ditolak, kode tanpa bukti --
 * beserta tingkat keyakinan. Data dari ai_review.analisis_kritis
 * (backend pemeriksaKritisService).
 */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TemuanKritis {
  jenis: string;
  keparahan: 'tinggi' | 'sedang' | 'rendah';
  pesan: string;
  saran?: string | null;
  bukti?: { kutipan?: string | null; page_number?: number | null } | null;
  sumber?: 'aturan' | 'ai' | 'pola_casemix';
}
export interface AnalisisKritis {
  skor_keyakinan: number;
  tingkat: 'tinggi' | 'sedang' | 'rendah';
  temuan: TemuanKritis[];
  ringkas?: { potensi_rugi_rs: number; potensi_upcoding: number; total: number };
  kesimpulan: string;
  catatan_ai?: string | null;
  catatan_klinis?: { jenis:string;pesan:string;halaman?:number;bukti?:{kutipan:string;page_number:number} }[];
  dinilai?: { dx: string[]; px: string[]; inacbg: string | null; tarif: number | null };
}

const LABEL_JENIS: Record<string, string> = {
  potensi_rugi_rs: 'Potensi rugi RS',
  potensi_upcoding: 'Berisiko ditolak/diaudit',
  kode_tidak_didukung: 'Kode tidak didukung',
  urutan_diagnosis: 'Diagnosis utama',
  kode_terlewat: 'Kode terlewat',
  inkonsistensi: 'Tidak konsisten',
};
const WARNA_TINGKAT = {
  tinggi: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
  sedang: 'border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300',
  rendah: 'border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400',
};
const TITIK = { tinggi: 'bg-red-600', sedang: 'bg-amber-500', rendah: 'bg-muted-foreground' };

export function AnalisisKritisCard({ analisis, onOpenPdf }: { analisis?: AnalisisKritis | null; onOpenPdf?: (page: number) => void }) {
  const [terbuka, setTerbuka] = useState(false);
  if (!analisis || typeof analisis.skor_keyakinan !== 'number') return null;
  const ada = analisis.temuan.length > 0;
  const urut = [...analisis.temuan].sort((a, b) => ['tinggi', 'sedang', 'rendah'].indexOf(a.keparahan) - ['tinggi', 'sedang', 'rendah'].indexOf(b.keparahan));
  return (
    <section aria-label="Pemeriksaan kritis aplikasi" className={cn('space-y-3 rounded-lg border p-4', WARNA_TINGKAT[analisis.tingkat])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {ada ? <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pemeriksaan kritis</p>
            <h4 className="font-semibold">Keyakinan {analisis.tingkat} · {analisis.skor_keyakinan}/100</h4>
            <p className="mt-1 text-sm text-foreground/85">{analisis.kesimpulan}</p>
          </div>
        </div>
        {ada && (
          <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0" aria-expanded={terbuka} onClick={() => setTerbuka(v => !v)}>
            {terbuka ? 'Ringkas' : `Lihat ${analisis.temuan.length} temuan`}
          </Button>
        )}
      </div>
      {analisis.dinilai && (
        <p className="text-xs text-muted-foreground">
          Dinilai: <span className="font-mono-data">{analisis.dinilai.dx.join('; ') || '—'}</span>
          {analisis.dinilai.px.length > 0 && <> · <span className="font-mono-data">{analisis.dinilai.px.join('; ')}</span></>}
          {analisis.dinilai.inacbg && <> · <span className="font-mono-data">{analisis.dinilai.inacbg}</span></>}
          {analisis.dinilai.tarif != null && <> · Rp{Math.round(analisis.dinilai.tarif).toLocaleString('id-ID')}</>}
        </p>
      )}
      {terbuka && ada && (
        <ul className="space-y-2 border-t border-current/10 pt-3">
          {urut.map((t, i) => (
            <li key={`${t.jenis}-${i}`} className="rounded-md bg-background/60 p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', TITIK[t.keparahan])} />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{LABEL_JENIS[t.jenis] || t.jenis}</span>
                <span className="sr-only">keparahan {t.keparahan}</span>
                {t.sumber === 'pola_casemix' && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">pola casemix</span>}
              </p>
              <p className="mt-1 text-foreground/90">{t.pesan}</p>
              {t.saran && <p className="mt-1 text-muted-foreground">Saran: {t.saran}</p>}
              {t.bukti?.kutipan && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-muted-foreground">
                  {t.bukti.page_number && onOpenPdf ? (
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onOpenPdf(t.bukti!.page_number!)}>
                      <FileText aria-hidden="true" className="size-3.5" />Hal. {t.bukti.page_number}
                    </Button>
                  ) : t.bukti.page_number ? <span>hal. {t.bukti.page_number}</span> : null}
                  <span className="min-w-0 break-words">“{t.bukti.kutipan}”</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {!!analisis.catatan_klinis?.length && <details className="rounded-md border border-border bg-background/60 p-3 text-foreground">
        <summary className="cursor-pointer text-sm font-medium">Konteks klinis untuk casemix</summary>
        <p className="mt-2 text-xs text-muted-foreground">Nilai lab dipakai untuk menilai kondisi dan pilihan terapi. Catatan ini tidak dihitung sebagai diagnosis terlewat atau risiko tarif.</p>
        <ul className="mt-2 list-disc space-y-2 pl-4 text-sm">{analisis.catatan_klinis.map((c,i)=><li key={i}>
          {(c.jenis !== 'konteks_penunjang' || !c.bukti) && <p>{c.pesan}</p>}
          {c.bukti && <p className="mt-1 break-words text-muted-foreground">{c.bukti.kutipan} (hal. {c.bukti.page_number})</p>}
          {(c.bukti?.page_number || c.halaman) && onOpenPdf && <Button type="button" variant="outline" size="sm" className="mt-1 h-7 gap-1 px-2 text-xs" onClick={()=>onOpenPdf(c.bukti?.page_number || c.halaman!)}><FileText className="size-3.5"/>Lihat hal. {c.bukti?.page_number || c.halaman}</Button>}
        </li>)}</ul>
      </details>}
      <p className="text-xs text-muted-foreground">Pemeriksaan otomatis aplikasi untuk membantu koder; keputusan tetap pada koder.</p>
    </section>
  );
}
