'use client';
/**
 * Tab "Saran AI" di bagian Diagnosis & Prosedur: kode diagnosis/prosedur dan
 * perkiraan INA-CBG & tarif yang disusun dari isi berkas (backend
 * saranKodingService). Hanya menampilkan saran -- tidak mengubah data klaim;
 * penerapannya lewat "Edit data" bila koder setuju.
 */
import { KodingReadinessNotice,type KesiapanKoding } from '@/components/KodingReadinessNotice';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AlertTriangle,ArrowRight,CheckCircle2,Lightbulb } from 'lucide-react';
import { useEffect,useState } from 'react';

interface Bukti { kutipan: string; halaman: number | null; sumber: string }
interface KodeSaran {
  kode: string;
  deskripsi: string | null;
  peran?: 'utama' | 'sekunder';
  asal: string[];
  bukti: Bukti[];
  catatan: string | null;
  // Diagnosis belum final: status klarifikasi per kode dari tinjauan.
  status_tinjauan?: string;
}
interface Perubahan {
  aturan: string; nama: string; aksi: string; dari: string[]; menjadi: string | null;
  pesan: string; sumber: string | null;
}
interface TinjauanDiagnosis {
  status: 'ada_saran' | 'perlu_klarifikasi' | 'belum_dinilai';
  ringkasan: string;
  kode_rekomendasi: string[];
  kandidat: { kode: string; deskripsi: string; status: string; alasan: string; bukti: { halaman: number; kutipan: string }[] }[];
  klarifikasi: string[];
  pemeriksaan_lanjutan?: { status: string; pesan?: string; pemicu?: string[] };
  perbandingan_model?: { awal: TinjauanDiagnosis; lanjutan: TinjauanDiagnosis };
}
// Pratinjau sesi dipakai bersama tab kode dan tarif, tanpa menyimpan ke klaim.
const tinjauanSesi = new Map<string, SaranKoding>();
interface SaranKoding {
  versi_data: string;
  tinjauan_diagnosis?: TinjauanDiagnosis | null;
  diagnosis_belum_final?: boolean;
  kesiapan_koding?: KesiapanKoding;
  diagnosis: KodeSaran[];
  prosedur: KodeSaran[];
  perubahan: Perubahan[];
  tidak_dipakai: { kode: string; jenis: string; alasan: string }[];
  inacbg: { kode: string; deskripsi: string | null; tarif: number | null; catatan_tarif: string | null; sementara?: boolean; kelas_asumsi?: boolean; perlu_verifikasi_grouper?: boolean; kelas_perawatan?: { kelas_hak: string | null; kelas_ditempati: string | null; naik_kelas: boolean; catatan: string } } | null;
  klaim_saat_ini: { diagnosis: string[]; prosedur: string[]; inacbg: string | null; tarif: number | null };
  sama_dengan_klaim: boolean;
  selisih_tarif: number | null;
  catatan: string[];
  casemix?: PerbandinganCasemix | null;
}
interface Himpunan { sama: string[]; hanya_ai: string[]; hanya_casemix: string[] }
// Lembar grouper E-Klaim (hasil casemix) -- pembanding, tidak pernah dibaca AI.
interface PerbandinganCasemix {
  alasan_perbedaan?: { jenis: string; kode?: string; pesan: string; bukti: { halaman?: number; kutipan: string }[] }[];
  sumber: string;
  halaman: number | null;
  versi_eklaim: string | null;
  casemix: { inacbg: { kode: string; deskripsi: string | null; tarif: number | null }; total_tarif: number | null };
  diagnosis_utama: { ai: string | null; casemix: string | null; cocok: boolean; sekategori: boolean };
  diagnosis: Himpunan;
  prosedur: Himpunan;
  inacbg: { ai: string | null; casemix: string; cocok: boolean };
  tarif: { ai: number | null; casemix: number | null; selisih: number | null };
  inti_cocok: boolean;
  semua_cocok: boolean;
}

const LABEL_ASAL: Record<string, string> = {
  diaglist: 'Data klaim',
  proclist: 'Data klaim',
  resume: 'Resume medis',
  tindakan: 'Tindakan terbaca',
  kombinasi: 'Aturan Berita Acara',
  penunjang: 'Hasil penunjang',
};
const LABEL_SUMBER: Record<string, string> = {
  resume_medis: 'Resume',
  triase_igd: 'Triase',
  penunjang: 'Penunjang',
};

const rupiah = (n: number) => n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function DaftarKode({ judul, kode, kosong, klaim }: { judul: string; kode: KodeSaran[]; kosong: string; klaim: string[] }) {
  return (
    <section className="min-w-0">
      <h4 className="mb-3 flex items-center justify-between text-base font-semibold text-foreground">{judul}<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{kode.length} kode</span></h4>
      {kode.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">{kosong}</p>
      ) : (
        <div className="space-y-2">
          {kode.map(k => (
            <div key={k.kode} className="rounded-lg border border-border bg-background/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-blue-500/10 px-2.5 py-1 font-mono text-lg font-bold text-blue-800 dark:text-blue-200">{k.kode}</code>
                {k.peran && <span className="text-sm font-medium text-foreground">{k.peran === 'utama' ? 'Diagnosis utama' : 'Diagnosis sekunder'}</span>}
                {k.status_tinjauan && k.status_tinjauan !== 'didukung' && <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">Perlu klarifikasi</span>}
                <span className={cn('ml-auto rounded-md px-2 py-1 text-xs font-medium', klaim.includes(k.kode) ? 'bg-muted text-foreground/80' : 'bg-amber-500/15 text-amber-800 dark:text-amber-200')}>
                  {klaim.includes(k.kode) ? 'Sama dengan klaim' : 'Usulan perubahan'}
                </span>
              </div>
              <p className="mt-2 break-words text-base leading-relaxed text-foreground">{k.deskripsi || 'Keterangan belum tersedia di kamus aplikasi'}</p>
              {k.bukti.length > 0 && (
                <div className="mt-3 border-l-2 border-blue-500/30 pl-3 text-sm leading-relaxed text-foreground/80">
                  <p>{LABEL_SUMBER[k.bukti[0].sumber] || 'Berkas'}{k.bukti[0].halaman ? ` · Hal. ${k.bukti[0].halaman}` : ''}</p>
                  <p className="mt-0.5">“{k.bukti[0].kutipan}”</p>
                  {k.bukti.length > 1 && <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-blue-800 dark:text-blue-200">{k.bukti.length - 1} bukti lainnya</summary>
                    {k.bukti.slice(1).map((b, i) => <p key={i} className="mt-2">{LABEL_SUMBER[b.sumber] || 'Berkas'}{b.halaman ? ` · Hal. ${b.halaman}` : ''}: “{b.kutipan}”</p>)}
                  </details>}
                </div>
              )}
              {k.asal.length > 0 && <details className="mt-3 text-sm text-foreground/80"><summary className="cursor-pointer">Sumber usulan</summary><p className="mt-1">{k.asal.map(a => LABEL_ASAL[a] || a).join(' · ')}</p></details>}
              {k.catatan && <p className="mt-3 text-sm leading-relaxed text-foreground/85">{k.catatan}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BarisBanding({ label, cocok, isi }: { label: string; cocok: boolean; isi: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-2.5 last:border-0">
      {cocok
        ? <CheckCircle2 aria-label="Cocok" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        : <AlertTriangle aria-label="Berbeda" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">{label}</p>
        <div className="mt-0.5 break-words text-foreground/80">{isi}</div>
      </div>
    </div>
  );
}

function DaftarBeda({ h }: { h: Himpunan }) {
  const bagian = [
    h.sama.length ? `Sama: ${h.sama.join(', ')}` : null,
    h.hanya_ai.length ? `Hanya AI: ${h.hanya_ai.join(', ')}` : null,
    h.hanya_casemix.length ? `Hanya casemix: ${h.hanya_casemix.join(', ')}` : null,
  ].filter(Boolean);
  return <span className="font-mono text-xs">{bagian.join(' · ') || '—'}</span>;
}

function BandingCasemix({ c }: { c: PerbandinganCasemix }) {
  const himpunanSama = (h: Himpunan) => h.hanya_ai.length === 0 && h.hanya_casemix.length === 0;
  return (
    <section aria-label="Perbandingan dengan hasil casemix" className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-foreground">Dibandingkan dengan hasil casemix (E-Klaim)</h4>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold',
          c.semua_cocok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : c.inti_cocok ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
              : 'bg-amber-500/15 text-amber-800 dark:text-amber-200')}>
          {c.semua_cocok ? 'Sama persis' : c.inti_cocok ? 'Diagnosis & tarif sama' : 'Berbeda'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Lembar grouper casemix{c.halaman ? ` (hal. ${c.halaman})` : ''} hanya dipakai sebagai pembanding; saran AI disusun tanpa membacanya.
      </p>
      <div className="mt-2">
        <BarisBanding label="Diagnosis utama" cocok={c.diagnosis_utama.cocok}
          isi={<span className="font-mono text-xs">AI {c.diagnosis_utama.ai || '—'} · Casemix {c.diagnosis_utama.casemix || '—'}{!c.diagnosis_utama.cocok && c.diagnosis_utama.sekategori ? ' (sekategori)' : ''}</span>} />
        <BarisBanding label="Diagnosis" cocok={himpunanSama(c.diagnosis)} isi={<DaftarBeda h={c.diagnosis} />} />
        <BarisBanding label="Prosedur" cocok={himpunanSama(c.prosedur)} isi={<DaftarBeda h={c.prosedur} />} />
        <BarisBanding label="INA-CBG" cocok={c.inacbg.cocok}
          isi={<span className="font-mono text-xs">AI {c.inacbg.ai || '—'} · Casemix {c.inacbg.casemix}</span>} />
        <BarisBanding label="Tarif" cocok={c.tarif.selisih === 0}
          isi={<span>AI {c.tarif.ai != null ? rupiah(c.tarif.ai) : '—'} · Casemix {c.tarif.casemix != null ? rupiah(c.tarif.casemix) : '—'}
            {c.tarif.selisih != null && c.tarif.selisih !== 0 ? ` · selisih ${c.tarif.selisih > 0 ? '+' : '−'}${rupiah(Math.abs(c.tarif.selisih))}` : ''}</span>} />
      </div>
      {Boolean(c.alasan_perbedaan?.length) && <details className="mt-3 border-t border-border pt-3 text-xs">
        <summary className="cursor-pointer font-medium text-foreground">Alasan perbedaan dan bukti</summary>
        <ul className="mt-2 space-y-3 text-muted-foreground">{c.alasan_perbedaan?.map((a, i) => <li key={i} className="leading-relaxed">
          {a.kode && <span className="mr-1 font-mono text-foreground">{a.kode}</span>}{a.pesan}
          {a.bukti?.map((b, j) => <blockquote key={j} className="mt-1 border-l-2 border-border pl-2">&ldquo;{b.kutipan}&rdquo;{b.halaman ? ` · halaman ${b.halaman}` : ''}</blockquote>)}
        </li>)}</ul>
      </details>}
    </section>
  );
}

export function SaranKodingPanel({ recordId, mode = 'kode' }: { recordId: string; mode?: 'kode' | 'tarif' }) {
  // Hasil disimpan bersama ID record-nya; selama ID belum cocok dengan record
  // yang ditampilkan, statusnya "memuat" -- tanpa setState sinkron di effect.
  const [hasil, setHasil] = useState<{ recordId: string; data: SaranKoding | null; gagal: boolean } | null>(null);

  const [percobaan, setPercobaan] = useState(0);
  const [meninjau, setMeninjau] = useState<string | null>(null);
  const [galatTinjauan, setGalatTinjauan] = useState<{ recordId: string; pesan: string } | null>(null);
  const tinjau = async (paksaSol = false) => {
    const id = recordId;
    setMeninjau(id);
    setGalatTinjauan(null);
    try {
      const baru: SaranKoding = await api.tinjauDiagnosis<SaranKoding>(id, paksaSol);
      tinjauanSesi.set(id, baru);
      setHasil(lama => lama?.recordId === id ? { recordId: id, data: baru, gagal: false } : lama);
    } catch  {
      setGalatTinjauan({ recordId: id, pesan: 'Tinjauan belum berhasil. Coba lagi.' });
    } finally { setMeninjau(null); }
  };
  useEffect(() => {
    if (!recordId) return;
    let aktif = true;
    api.getSaranKoding<SaranKoding>(recordId)
      .then((data: SaranKoding) => {
        const preview = tinjauanSesi.get(recordId);
        if (preview && preview.versi_data !== data.versi_data) tinjauanSesi.delete(recordId);
        if (aktif) setHasil({ recordId, data: preview?.versi_data === data.versi_data ? preview : data, gagal: false });
      })
      .catch(() => { if (aktif) setHasil({ recordId, data: null, gagal: true }); });
    return () => { aktif = false; };
  }, [recordId, percobaan]);

  const status = hasil?.recordId !== recordId ? 'memuat' : hasil.gagal ? 'gagal' : 'siap';
  const data = status === 'siap' ? hasil!.data : null;

  if (status === 'memuat') return <div role="status" className="space-y-3 p-5"><p className="text-sm text-muted-foreground">{mode === 'tarif' ? 'Memuat perbandingan tarif…' : 'Menyusun saran koding…'}</p><div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /></div>;
  if (status === 'gagal' || !data) return <div role="alert" className="space-y-3 p-5"><p className="text-sm text-destructive">Saran koding belum dapat dimuat.</p><Button variant="outline" size="sm" onClick={() => { setHasil(null); setPercobaan(n => n + 1); }}>Coba lagi</Button></div>;

  const klaim = data.klaim_saat_ini;
  return (
    <div className={cn('space-y-5', mode === 'kode' && 'p-4 sm:p-5')}>
      {mode === 'kode' && <>
      <KodingReadinessNotice kesiapan={data.kesiapan_koding} />
      <section aria-label="Tinjauan diagnosis sesuai kasus" className="space-y-3 rounded-lg border border-blue-500/25 bg-blue-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-semibold text-foreground">Diagnosis yang sesuai dengan kasus</h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={meninjau === recordId} onClick={() => tinjau()}>
              {meninjau === recordId ? 'Menilai bukti kasus…' : data.tinjauan_diagnosis ? 'Tinjau kembali' : 'Tinjau sesuai kasus'}
            </Button>
            <Button size="sm" variant="outline" disabled={meninjau === recordId} onClick={() => tinjau(true)}>
              Pemeriksaan lanjutan
            </Button>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">{data.tinjauan_diagnosis?.ringkasan || 'Bandingkan diagnosis dokter di resume dengan anamnesis, pemeriksaan, dan penunjang sebelum memilih kode.'}</p>
        {galatTinjauan?.recordId === recordId && <p role="alert" className="text-sm text-destructive">{galatTinjauan.pesan}</p>}
        {meninjau === recordId && <p role="status" className="text-sm text-muted-foreground">AI sedang meninjau bukti dari berkas.</p>}
        {data.tinjauan_diagnosis?.kandidat.map(k => <details key={k.kode} className="rounded-md border border-border bg-background/60 p-3 text-sm">
          <summary className="cursor-pointer"><code className="mr-2 font-semibold">{k.kode}</code>{k.status === 'didukung' ? 'Didukung berkas' : k.status === 'perlu_klarifikasi' ? 'Perlu klarifikasi' : 'Tidak diprioritaskan'}</summary>
          <p className="mt-2 leading-relaxed">{k.alasan}</p>
          {k.bukti.map((b, i) => <p key={i} className="mt-2 text-foreground/75">Hal. {b.halaman}: “{b.kutipan}”</p>)}
        </details>)}
        {!!data.tinjauan_diagnosis?.klarifikasi.length && <ul className="list-disc space-y-1 pl-5 text-sm">{data.tinjauan_diagnosis.klarifikasi.map((k, i) => <li key={i}>{k}</li>)}</ul>}
        {data.tinjauan_diagnosis?.pemeriksaan_lanjutan && data.tinjauan_diagnosis.pemeriksaan_lanjutan.status !== 'tidak_diperlukan' && <p role="status" className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
          {data.tinjauan_diagnosis.pemeriksaan_lanjutan.pesan || 'Pemeriksaan lanjutan tersedia untuk ditinjau.'}
        </p>}
        {data.tinjauan_diagnosis?.perbandingan_model && <details className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Bandingkan alasan kedua pemeriksaan</summary>
          {[['Pemeriksaan awal', data.tinjauan_diagnosis.perbandingan_model.awal], ['Pemeriksaan lanjutan', data.tinjauan_diagnosis.perbandingan_model.lanjutan]].map(([label, hasil]) => {
            const tinjauan = hasil as TinjauanDiagnosis;
            return <div key={label as string} className="mt-3 space-y-2">
              <p className="font-medium">{label as string}</p>
              <p>{tinjauan.ringkasan}</p>
              {tinjauan.kandidat.map(k => <div key={k.kode} className="rounded-md border border-border bg-background/60 p-3">
                <p><code className="font-semibold">{k.kode}</code> · {k.alasan}</p>
                {k.bukti.map((b, i) => <p key={i} className="mt-2 text-foreground/75">Hal. {b.halaman}: “{b.kutipan}”</p>)}
              </div>)}
            </div>;
          })}
        </details>}
        {data.tinjauan_diagnosis && <p className="text-xs text-muted-foreground">Tinjauan menjadi saran untuk koder. Data klaim dan tanda risiko belum diubah.</p>}
      </section>
      {data.kesiapan_koding?.status !== 'berisiko_pending' && <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
        data.sama_dengan_klaim
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
          : 'border-border bg-muted/30 text-foreground')}>
        {data.sama_dengan_klaim
          ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
        <span>
          {data.sama_dengan_klaim
            ? 'Kode klaim sama dengan saran AI.'
            : 'Usulan belum diterapkan. Gunakan Edit data setelah kode disetujui.'}
        </span>
      </div>}

      {data.perubahan.length > 0 && data.kesiapan_koding?.status !== 'berisiko_pending' && (
        <div className="space-y-2">
          {data.perubahan.map(p => (
            <div key={p.aturan} className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <Lightbulb className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>{p.nama}</span>
                <span className="font-mono text-foreground/80">{p.dari.join(' + ')}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-mono font-semibold">{p.menjadi || `buang ${p.dari.slice(-1).join(', ')}`}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.pesan}{p.sumber ? ` Sumber: ${p.sumber} (${p.aturan}).` : ''}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <DaftarKode judul={data.diagnosis_belum_final ? "Diagnosis · rekomendasi sementara agen" : "Diagnosis · ICD-10 WHO"} kode={data.diagnosis} klaim={klaim.diagnosis} kosong="Belum ada diagnosis yang terbaca dari berkas." />
        <DaftarKode judul="Prosedur · ICD-9-CM" kode={data.prosedur} klaim={klaim.prosedur} kosong="Tidak ada tindakan yang terbaca dari resume atau triase." />
      </div>

      {data.casemix && <BandingCasemix c={data.casemix} />}

      {data.perubahan.length > 0 && data.kesiapan_koding?.status === 'berisiko_pending' && <details className="text-sm text-foreground/80"><summary className="cursor-pointer">Dasar usulan perubahan kode</summary>{data.perubahan.map(p => <p key={p.aturan} className="mt-2">{p.nama}: {p.pesan}{p.sumber ? ` Sumber: ${p.sumber} (${p.aturan}).` : ''}</p>)}</details>}
      {data.tidak_dipakai.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tidak dipakai</h4>
          <ul className="space-y-1 text-sm">
            {data.tidak_dipakai.map(t => (
              <li key={`${t.jenis}-${t.kode}`}><code className="mr-2 font-mono font-semibold text-foreground">{t.kode}</code><span className="text-muted-foreground">{t.alasan}</span></li>
            ))}
          </ul>
        </div>
      )}

      </>}
      {mode === 'tarif' && <div>
        <h4 className="text-sm font-semibold text-foreground">Perbandingan INA-CBG & tarif</h4>
        <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">Data klaim saat ini dibandingkan dengan perkiraan dari saran AI. Tarif saran belum diterapkan ke klaim.</p>
        <div className={cn('grid gap-3', data.casemix ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          <div className="min-w-0 space-y-2 rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Data klaim saat ini</p>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{klaim.diagnosis.join('; ') || '—'}{klaim.prosedur.length ? ` · ${klaim.prosedur.join('; ')}` : ''}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{klaim.inacbg || '—'}</p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{klaim.tarif != null ? rupiah(klaim.tarif) : 'Tarif hasil E-Klaim belum tersedia'}</p>
          </div>
          <div className="min-w-0 space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Perkiraan saran AI</p>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{data.diagnosis.map(d => d.kode).join('; ') || '—'}{data.prosedur.length ? ` · ${data.prosedur.map(p => p.kode).join('; ')}` : ''}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{data.inacbg?.kode || '—'}</p>
            {data.inacbg?.deskripsi && <p className="text-xs text-muted-foreground">{data.inacbg.deskripsi}</p>}
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {data.inacbg?.tarif != null ? rupiah(data.inacbg.tarif) : (data.inacbg?.catatan_tarif || 'Tarif belum terhitung')}
            </p>
            {data.inacbg?.perlu_verifikasi_grouper && <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">{data.inacbg.catatan_tarif || 'Perkiraan aplikasi memakai acuan tingkat I. Tingkat final perlu hasil grouper E-Klaim.'}</p>}
            {data.inacbg?.sementara && <p className="text-xs text-amber-700 dark:text-amber-300">Perkiraan sementara Agen Casemix: ada diagnosis yang perlu klarifikasi; tarif dapat berubah.</p>}
            {data.inacbg?.kelas_perawatan && <p className="text-xs leading-relaxed text-muted-foreground">Kelas hak {data.inacbg.kelas_perawatan.kelas_hak || 'belum terbaca'} · kamar {data.inacbg.kelas_perawatan.kelas_ditempati || 'belum terbaca'}. {data.inacbg.kelas_perawatan.catatan}</p>}
            {data.inacbg?.kelas_asumsi && <p className="text-xs text-amber-700 dark:text-amber-300">Kelas rawat tidak terbaca; memakai tarif kelas 3.</p>}
          </div>
          {data.casemix && <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold text-foreground">Hasil casemix (E-Klaim)</p>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">{data.casemix.casemix.inacbg.kode}</p>
            {data.casemix.casemix.inacbg.deskripsi && <p className="text-xs text-muted-foreground">{data.casemix.casemix.inacbg.deskripsi}</p>}
            <p className="text-xl font-semibold tabular-nums text-foreground">{data.casemix.casemix.total_tarif != null ? rupiah(data.casemix.casemix.total_tarif) : '—'}</p>
            <p className="text-xs text-muted-foreground">Pembanding, bukan sumber data klaim.</p>
          </div>}
        </div>
        <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
          {data.selisih_tarif == null ? 'Selisih belum dapat dihitung karena tarif belum lengkap.' : data.selisih_tarif === 0 ? 'Tarif tetap · tidak ada selisih' : `Selisih perkiraan: ${data.selisih_tarif > 0 ? '+' : '−'}${rupiah(Math.abs(data.selisih_tarif))}`}
        </p>
      </div>}

      {data.catatan.length > 0 && <ul className="space-y-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {data.catatan.map((c, i) => <li key={i}>{c}</li>)}
      </ul>}
    </div>
  );
}
