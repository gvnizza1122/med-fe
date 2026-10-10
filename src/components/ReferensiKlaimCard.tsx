'use client';
import { type PedomanKasus } from './PedomanKasusCard';
import { BookOpen, CheckCircle2, CircleHelp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Bukti {
  id: string; nama: string; status: string; catatan?: string;
  bukti: { page_number?: number; kutipan: string; tanggal?: string; nilai?: number }[];
}
interface Temuan {
  id: string; nama: string; status: string; catatan: string; keterbatasan: string[]; kelompok_usia?: string;
  jenis_ketentuan: string; kode_diagnosis: string[]; kode_prosedur: string[]; bukti: Bukti[];
  sumber: { judul: string; nomor: string | null; url: string; halaman: string; versi: string; catatan: string; butir?: number | string; teks_asli?: string; status_verifikasi?: string; arsip?: string; sha256?: string };
}
export interface HasilReferensiKlaim {
  pedoman_terkait?: PedomanKasus;
  kelompok_usia?: string; versi?: string; diperiksa_pada?: string; catatan?: string; konfigurasi_belum_terbaca?: boolean; temuan: Temuan[];
}
const USIA: Record<string,string> = { anak:'Kasus anak', neonatus:'Kasus neonatus', dewasa:'Kasus dewasa', belum_terkonfirmasi:'Usia perlu dikonfirmasi' };
const LABEL: Record<string,string> = {
  perlu_konfirmasi_usia:'Konfirmasi usia sebelum menilai kriteria', belum_dapat_dinilai:'Telaah casemix',
  telaah_rekomendasi: 'Rekomendasi perlu ditelaah bersama bukti',
  ambang_terpenuhi: 'Ambang catatan terpenuhi', ambang_tidak_terpenuhi: 'Ambang catatan belum terpenuhi',
  perlu_telaah_koding: 'Nilai dan syarat perlu ditelaah', perlu_cek_manual: 'Perlu pemeriksaan manual',
  bukti_ditemukan: 'Bukti ditemukan', bukti_belum_cukup: 'Rincian ditelaah casemix',
  perlu_konfirmasi_ketentuan: 'Cakupan ketentuan perlu dikonfirmasi', tidak_terindikasi_rutin: 'Tidak rutin diwajibkan',
};
export function ReferensiKlaimCard({ hasil }: { hasil?: HasilReferensiKlaim }) {
  if (!hasil || (!hasil.temuan?.length && !hasil.catatan)) return null;
  return <section aria-label="Referensi kesesuaian klaim" className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><BookOpen aria-hidden="true" className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Referensi Kesesuaian Klaim</h3>
      {hasil.kelompok_usia && <Badge variant="outline" className="text-xs">{USIA[hasil.kelompok_usia] || 'Usia perlu dikonfirmasi'}</Badge>}

    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hasil.catatan}</p>
    {hasil.konfigurasi_belum_terbaca && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-400">Pengaturan RS belum berhasil dimuat; ketentuan lokal belum dapat dinilai.</p>}

    <div className="mt-4 space-y-3">{hasil.temuan.map(t => <article key={t.id} className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <h4 className="text-sm font-medium">{t.nama}</h4><Badge variant="outline" className="text-xs">{t.jenis_ketentuan === 'cakupan_usia' ? 'Pemilihan kriteria sesuai usia' : t.jenis_ketentuan === 'catatan_casemix' ? 'Catatan casemix · perlu konfirmasi' : t.jenis_ketentuan === 'rekomendasi_tkmkb' ? 'Rekomendasi audit · TKMKB' : t.jenis_ketentuan === 'pedoman_klinis' ? 'Dukungan diagnosis · PNPK' : 'Verifikasi klaim BPJS'}</Badge>
        {t.kelompok_usia && <Badge variant="outline" className="text-xs">{USIA[t.kelompok_usia]}</Badge>}
        <span className="text-xs text-muted-foreground">{[...t.kode_diagnosis,...t.kode_prosedur].join(' · ')}</span>
      </div>
      <div className="space-y-3 p-4"><p className="text-xs font-medium text-amber-700 dark:text-amber-400">{LABEL[t.status] || 'Perlu ditinjau'}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{t.catatan}</p>
        {t.keterbatasan.map((s,i) => <p key={i} className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">{s}</p>)}
        <ul className="space-y-2 text-xs">{t.bukti.map(b => <li key={b.id} className="flex items-start gap-2">
          {['bukti_ditemukan','ambang_terpenuhi'].includes(b.status) ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <CircleHelp aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span><span className="font-medium">{b.nama}</span> · {LABEL[b.status] || 'Telaah casemix'}{b.bukti?.length ? <span className="mt-1 block space-y-1 text-muted-foreground">{b.bukti.slice(0,2).map((e,i)=><span key={i} className="block leading-relaxed">• {e.kutipan}{e.page_number ? ` (hal. ${e.page_number})` : ''}</span>)}</span> : b.catatan && <span className="block leading-relaxed text-muted-foreground">{b.catatan}</span>}</span>
        </li>)}</ul>

      </div>
    </article>)}</div>
  </section>;
}
