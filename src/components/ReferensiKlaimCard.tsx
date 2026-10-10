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
  perlu_konfirmasi_ketentuan: 'Penerapan ketentuan ditelaah casemix', tidak_terindikasi_rutin: 'Tidak rutin diwajibkan',
};
const DITEMUKAN=new Set(['bukti_ditemukan','ambang_terpenuhi']);
function kriteria(nama:string) {
  return nama.replace(/^BA\s+\d{4}\s+Aspek\s+(?:medis|administrasi)\s+\d+[a-z]?\s*:\s*/i,'');
}
function judulButir(b:Bukti) {
  const nama:Record<string,string>={
    'BA-18-M17:kriteria_akut':'Oksigenasi / parameter gagal napas akut',
    'BA-18-M17:kriteria_kronik':'Parameter gagal napas kronik',
    'BA-18-M17:terapi_oksigen':'Terapi oksigen / bantuan napas',
  };
  return nama[b.id]||kriteria(b.nama);
}
function RincianKriteria({nama}:{nama:string}) {
  const teks=kriteria(nama),alternatif=/^Salah satu:\s*/i.test(teks);
  const poin=alternatif?teks.replace(/^Salah satu:\s*/i,'').split(/,\s+(?:atau\s+)?/):[teks];
  return <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Kriteria yang ditelaah</summary>
    {alternatif&&<p className="mt-2 font-medium">Cukup salah satu kriteria berikut:</p>}
    <ul className="mt-1 list-disc space-y-1 pl-4 leading-relaxed">{poin.map((p,i)=><li key={i}>{p}</li>)}</ul>
  </details>;
}
export function ReferensiKlaimCard({ hasil }: { hasil?: HasilReferensiKlaim }) {
  if (!hasil || (!hasil.temuan?.length && !hasil.catatan)) return null;
  return <section aria-label="Referensi kesesuaian klaim" className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
    <div className="flex flex-wrap items-center gap-2"><BookOpen aria-hidden="true" className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Bukti dan telaah klaim</h3>
      {hasil.kelompok_usia && <Badge variant="outline" className="text-xs">{USIA[hasil.kelompok_usia] || 'Usia perlu dikonfirmasi'}</Badge>}

    </div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Bukti penting dari berkas dan rincian yang perlu dicocokkan casemix.</p>
    {hasil.konfigurasi_belum_terbaca && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-400">Pengaturan RS belum berhasil dimuat; ketentuan lokal belum dapat dinilai.</p>}

    <div className="mt-4 space-y-3">{hasil.temuan.map(t => {
      const didukung=t.bukti.length>0&&t.bukti.every(b=>DITEMUKAN.has(b.status)||b.status==='tidak_terindikasi_rutin');
      const catatanKlinis=(t.keterbatasan||[]).filter(s=>!/^(?:Sumber\b|Rujukan\b|Salinan\b|PNPK dari Katalog\b|Kriteria PNPK dinilai\b)/i.test(s));
      return <article key={t.id} className="overflow-hidden rounded-lg border border-border">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
          <div className="min-w-0"><h4 className="text-sm font-semibold">{t.nama}</h4><p className="mt-1 break-words font-mono-data text-xs text-muted-foreground">{[...t.kode_diagnosis,...t.kode_prosedur].join(' · ')}</p></div>
          <Badge variant="outline" className="text-xs">{t.jenis_ketentuan==='cakupan_usia'?'Kriteria sesuai usia':t.jenis_ketentuan==='catatan_casemix'?'Telaah casemix':t.jenis_ketentuan==='rekomendasi_tkmkb'?'Telaah audit':t.jenis_ketentuan==='pedoman_klinis'?'Dukungan diagnosis':'Telaah klaim'}</Badge>
        </header>
        <div className="space-y-4 p-4">
          <p className={`text-xs font-medium ${didukung||DITEMUKAN.has(t.status)?'text-emerald-700 dark:text-emerald-400':'text-muted-foreground'}`}>{didukung?'Bukti pendukung ditemukan':LABEL[t.status]||'Telaah casemix'}</p>
          {!!t.bukti.length&&<ul className="space-y-3">{t.bukti.map(b=><li key={b.id} className="min-w-0 rounded-lg bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              {DITEMUKAN.has(b.status)?<CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>:<CircleHelp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>}
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium leading-relaxed">{judulButir(b)}</p>
                {!DITEMUKAN.has(b.status)&&<p className="mt-1 text-xs text-muted-foreground">{LABEL[b.status]||'Telaah casemix'}</p>}
                {!!b.bukti?.length&&<ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">{b.bukti.slice(0,2).map((e,i)=><li key={i} className="break-words">{e.kutipan}{e.page_number?<span className="ml-1 whitespace-nowrap text-xs">(hal. {e.page_number})</span>:null}</li>)}</ul>}
                {!b.bukti?.length&&b.catatan&&<p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.catatan}</p>}
                {judulButir(b)!==kriteria(b.nama)&&<RincianKriteria nama={b.nama}/>}
              </div>
            </div>
          </li>)}</ul>}
          {(t.catatan||t.status==='perlu_konfirmasi_ketentuan'||catatanKlinis.length>0)&&<div className="border-t border-border pt-3">
            <p className="text-xs font-medium">Catatan untuk casemix</p><ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
              {t.catatan&&<li>{t.catatan}</li>}
              {t.status==='perlu_konfirmasi_ketentuan'&&<li>Penerapan ketentuan dicocokkan dengan episode pelayanan.</li>}
              {catatanKlinis.map((s,i)=><li key={i}>{s}</li>)}
            </ul>
          </div>}
        </div>
      </article>;
    })}</div>
  </section>;
}
