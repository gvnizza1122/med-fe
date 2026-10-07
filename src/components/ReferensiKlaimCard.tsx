'use client';
import { BookOpen, CheckCircle2, CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Bukti {
  id: string; nama: string; status: string; catatan?: string;
  bukti: { page_number?: number; kutipan: string; tanggal?: string; nilai?: number }[];
}
interface Temuan {
  id: string; nama: string; status: string; catatan: string; keterbatasan: string[];
  jenis_ketentuan: string; kode_diagnosis: string[]; kode_prosedur: string[]; bukti: Bukti[];
  sumber: { judul: string; nomor: string | null; url: string; halaman: string; versi: string; catatan: string };
}
export interface HasilReferensiKlaim {
  versi?: string; diperiksa_pada?: string; catatan?: string; konfigurasi_belum_terbaca?: boolean; temuan: Temuan[];
}
const LABEL: Record<string,string> = {
  bukti_ditemukan: 'Bukti ditemukan', bukti_belum_cukup: 'Bukti perlu dilengkapi atau ditelaah',
  perlu_konfirmasi_ketentuan: 'Cakupan ketentuan perlu dikonfirmasi', tidak_terindikasi_rutin: 'Tidak rutin diwajibkan',
};
export function ReferensiKlaimCard({ hasil }: { hasil?: HasilReferensiKlaim }) {
  if (!hasil || (!hasil.temuan?.length && !hasil.catatan)) return null;
  return <section aria-label="Referensi kesesuaian klaim" className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><BookOpen aria-hidden="true" className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Referensi Kesesuaian Klaim</h3>
      {hasil.diperiksa_pada && <Badge variant="outline" className="text-xs">Sumber diperiksa {hasil.diperiksa_pada}</Badge>}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hasil.catatan}</p>
    {hasil.konfigurasi_belum_terbaca && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-400">Pengaturan RS belum berhasil dimuat; ketentuan lokal belum dapat dinilai.</p>}
    <div className="mt-4 space-y-3">{hasil.temuan.map(t => <article key={t.id} className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <h4 className="text-sm font-medium">{t.nama}</h4><Badge variant="outline" className="text-xs">{t.jenis_ketentuan === 'pedoman_klinis' ? 'Dukungan diagnosis · PNPK' : 'Verifikasi klaim BPJS'}</Badge>
        <span className="text-xs text-muted-foreground">{[...t.kode_diagnosis,...t.kode_prosedur].join(' · ')}</span>
      </div>
      <div className="space-y-3 p-4"><p className="text-xs font-medium text-amber-700 dark:text-amber-400">{LABEL[t.status] || 'Perlu ditinjau'}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.catatan}</p>
        {t.keterbatasan.map((s,i) => <p key={i} className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">{s}</p>)}
        {t.bukti.map(b => <details key={b.id} className="rounded-md border border-border p-3 text-xs">
          <summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {b.status === 'bukti_ditemukan' ? <CheckCircle2 aria-hidden="true" className="mr-2 inline h-3.5 w-3.5 text-emerald-600" /> : <CircleHelp aria-hidden="true" className="mr-2 inline h-3.5 w-3.5 text-amber-600" />}
            {b.nama} <span className="text-muted-foreground">· {LABEL[b.status] || 'Perlu ditinjau'}</span>
          </summary>
          {b.catatan && <p className="mt-2 leading-relaxed text-muted-foreground">{b.catatan}</p>}
          {b.bukti.length ? b.bukti.map((e,i) => <blockquote key={i} className="mt-2 break-words border-l-2 border-primary/30 pl-3 leading-relaxed text-muted-foreground">{e.kutipan}{e.page_number ? ` (hal. ${e.page_number})` : ''}{e.tanggal ? ` · ${e.tanggal}` : ''}</blockquote>) : <p className="mt-2 text-muted-foreground">Bukti hasil belum terkonfirmasi dari teks tersimpan. Ini tidak membuktikan pemeriksaan tidak dilakukan.</p>}
        </details>)}
        <details className="text-xs"><summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sumber, versi, dan cakupan</summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">{t.sumber.judul} · {t.sumber.nomor || t.sumber.versi} · halaman {t.sumber.halaman}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">{t.sumber.catatan}</p>
          {/^https:\/\//.test(t.sumber.url) && <a className="mt-2 inline-block text-primary underline underline-offset-4" href={t.sumber.url} target="_blank" rel="noopener noreferrer">Buka dokumen sumber</a>}
        </details>
      </div>
    </article>)}</div>
  </section>;
}
