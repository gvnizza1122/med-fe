'use client';
/**
 * Agen Casemix: laporan casemix satu berkas (rekomendasi koding berstatus,
 * kronologi, persyaratan berregulasi, pertanyaan klarifikasi, alternatif
 * koding sah + dampak tarif, jejak kerja) dan mode tanya-jawab dengan agen.
 * Data dari backend agenCasemixService / agenCasemixInteraktifService.
 * Agen = casemix RUJUKAN; keputusan akhir pada casemix RS. Keputusan final
 * yang dicatat casemix RS dipelajari aplikasi untuk kasus berikutnya
 * (keputusanCasemixService). Tidak mengubah data klaim.
 */
import { useEffect, useRef, useState } from 'react';
import { Bot, FileText, GraduationCap, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type StatusKode = 'didukung_bukti' | 'perlu_klarifikasi' | 'belum_cukup_bukti' | 'belum_dinilai';
interface Bukti { kutipan: string; halaman: number | null; jenis?: string }
interface Rekomendasi { jenis: 'diagnosis' | 'prosedur'; peran?: 'utama' | 'sekunder'; kode: string; deskripsi: string | null; status: StatusKode; alasan: string | null; bukti: Bukti[]; ketidakpastian: string[] }
interface Regulasi { id: string; judul: string; nomor: string | null; versi: string; berlaku: boolean }
interface Syarat { syarat: string; status: 'terpenuhi' | 'perlu_konfirmasi' | 'belum_ditemukan'; sumber: string; regulasi?: Regulasi | null; bukti: string | null }
interface Pertanyaan { untuk: 'dokter' | 'koder'; pertanyaan: string; dasar: string | null; halaman: number | null }
interface Grup { diagnosis: string[]; prosedur: string[]; inacbg: string | null; deskripsi: string | null; tarif: number | null }
interface Alternatif extends Grup { jenis: 'kepatuhan' | 'optimasi'; judul: string; selisih_tarif: number | null; syarat: string }
interface Peristiwa { tanggal: string; jam: string | null; peristiwa: string; halaman: number; kutipan: string }
interface LangkahJejak { nama: string; status: string | null; biaya_idr: number | null; keterangan: string | null; oleh?: 'agen' | 'luna' | 'sol' }
interface Laporan {
  status: 'siap_ditinjau' | 'perlu_klarifikasi' | 'berisiko';
  ringkasan_klinis: { narasi: string | null };
  kronologi: Peristiwa[];
  rekomendasi_koding: Rekomendasi[];
  persyaratan: Syarat[];
  pertanyaan_klarifikasi: Pertanyaan[];
  kondisi_tersirat: { kondisi: string; kutipan: string; halaman: number | null }[];
  risiko_pending: { sumber: string; ringkas: string; keparahan: string }[];
  alternatif_koding: { dasar: Grup; alternatif: Alternatif[] };
  keyakinan: { skor: number; tingkat: string } | null;
  jejak_kerja: { langkah: LangkahJejak[]; total_biaya_ai_idr: number; sumber?: 'orkestrator'; durasi_detik?: number };
  keputusan_casemix: Keputusan | null;
  pelajaran_casemix: { kode: string; pola: 'sering_dihapus' | 'sering_ditambah'; pesan: string }[];
  catatan: string;
}
interface Keputusan { diagnosis: string[]; prosedur: string[]; inacbg: string | null; tarif: number | null; perbedaan: string[]; catatan: string | null; diputuskan_pada: string }
interface HasilKeputusan {
  cocok: boolean; perbedaan: string[]; selisih_tarif: number | null; di_luar_kamus: string[];
  final: { inacbg: string | null; tarif: number | null };
  dihapus_casemix: { diagnosis: string[]; prosedur: string[] }; ditambah_casemix: { diagnosis: string[]; prosedur: string[] };
}
interface Pesan { peran: 'koder' | 'agen'; isi: string; rujukan?: { halaman: number; kutipan: string }[]; biaya?: number }

const LABEL_STATUS: Record<Laporan['status'], string> = { siap_ditinjau: 'Siap ditinjau', perlu_klarifikasi: 'Perlu klarifikasi', berisiko: 'Berisiko pending' };
const WARNA_STATUS: Record<Laporan['status'], string> = {
  siap_ditinjau: 'border-emerald-500/30 bg-emerald-500/5',
  perlu_klarifikasi: 'border-amber-500/40 bg-amber-500/5',
  berisiko: 'border-red-500/40 bg-red-500/5',
};
const LABEL_KODE: Record<StatusKode, string> = { didukung_bukti: 'Didukung bukti', perlu_klarifikasi: 'Perlu klarifikasi', belum_cukup_bukti: 'Belum cukup bukti', belum_dinilai: 'Belum dinilai' };
const WARNA_KODE: Record<StatusKode, string> = {
  didukung_bukti: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  perlu_klarifikasi: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  belum_cukup_bukti: 'bg-red-500/10 text-red-700 dark:text-red-400',
  belum_dinilai: 'bg-muted text-muted-foreground',
};
const LABEL_SYARAT = { terpenuhi: 'Terpenuhi', perlu_konfirmasi: 'Perlu konfirmasi', belum_ditemukan: 'Belum ditemukan' };
const CONTOH_TANYA = ['Kenapa diagnosis utama ini dipilih?', 'Berapa selisih tarif bila diagnosis sekunder dihapus?', 'Buat draf jawaban bila klaim ini dipending'];

const rupiah = (n: number | null | undefined) => (n == null ? '—' : `Rp${Math.round(n).toLocaleString('id-ID')}`);

function Hal({ halaman, onOpenPdf }: { halaman: number | null; onOpenPdf?: (page: number) => void }) {
  if (!halaman) return null;
  if (!onOpenPdf) return <span className="text-xs text-muted-foreground">hal. {halaman}</span>;
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onOpenPdf(halaman)}>
      <FileText aria-hidden="true" className="size-3" />Hal. {halaman}
    </Button>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{judul}</h5>
      {children}
    </div>
  );
}

function KeputusanCasemixForm({ recordId, laporan, onTersimpan }: { recordId: string; laporan: Laporan; onTersimpan: () => void }) {
  const awal = laporan.keputusan_casemix;
  const rekDx = laporan.rekomendasi_koding.filter(r => r.jenis === 'diagnosis').map(r => r.kode);
  const rekPx = laporan.rekomendasi_koding.filter(r => r.jenis === 'prosedur').map(r => r.kode);
  const [dx, setDx] = useState((awal?.diagnosis ?? rekDx).join('; '));
  const [px, setPx] = useState((awal?.prosedur ?? rekPx).join('; '));
  const [catatan, setCatatan] = useState(awal?.catatan ?? '');
  const [menyimpan, setMenyimpan] = useState(false);
  const [hasil, setHasil] = useState<HasilKeputusan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true); setGalat(null);
    try {
      const r: HasilKeputusan = await api.simpanKeputusanCasemix<HasilKeputusan>(recordId, { diagnosis: dx, prosedur: px, catatan });
      setHasil(r);
      onTersimpan();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Keputusan belum dapat disimpan.');
    } finally {
      setMenyimpan(false);
    }
  }

  const daftar = (a: string[]) => a.join(', ') || '—';
  return (
    <form onSubmit={simpan} className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Diisi casemix RS setelah memutuskan koding akhir. Data klaim tidak diubah; keputusan ini dibandingkan dengan rekomendasi agen dan dipelajari untuk kasus berikutnya.
      </p>
      {awal && <p className="text-xs">Tercatat: <span className="font-mono-data">{daftar(awal.diagnosis)} | {daftar(awal.prosedur)}</span>{awal.inacbg && <> · <span className="font-mono-data">{awal.inacbg}</span> {rupiah(awal.tarif)}</>}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">Diagnosis final (utama dulu, pisahkan dengan ;)
          <Input value={dx} onChange={e => setDx(e.target.value)} className="font-mono-data text-sm" required />
        </label>
        <label className="space-y-1 text-xs">Prosedur final
          <Input value={px} onChange={e => setPx(e.target.value)} className="font-mono-data text-sm" />
        </label>
      </div>
      <label className="block space-y-1 text-xs">Alasan bila berbeda dari rekomendasi (membantu aplikasi belajar)
        <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} maxLength={1000} className="resize-none text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" className="min-h-9" disabled={menyimpan || !dx.trim()}>{menyimpan ? 'Menyimpan…' : awal ? 'Perbarui keputusan' : 'Simpan keputusan casemix'}</Button>
        {galat && <p role="alert" className="text-sm text-destructive">{galat}</p>}
      </div>
      {hasil && (
        <div role="status" className="rounded-md bg-background/70 p-3 text-sm">
          {hasil.cocok
            ? <p>Keputusan casemix sama dengan rekomendasi agen.</p>
            : (
              <ul className="space-y-0.5">
                {hasil.dihapus_casemix.diagnosis.length + hasil.dihapus_casemix.prosedur.length > 0 && <li>Tidak dipakai casemix: <span className="font-mono-data">{daftar([...hasil.dihapus_casemix.diagnosis, ...hasil.dihapus_casemix.prosedur])}</span></li>}
                {hasil.ditambah_casemix.diagnosis.length + hasil.ditambah_casemix.prosedur.length > 0 && <li>Ditambahkan casemix: <span className="font-mono-data">{daftar([...hasil.ditambah_casemix.diagnosis, ...hasil.ditambah_casemix.prosedur])}</span></li>}
                <li>INA-CBG final <span className="font-mono-data">{hasil.final.inacbg || '—'}</span> {rupiah(hasil.final.tarif)}{hasil.selisih_tarif != null && hasil.selisih_tarif !== 0 && <> · selisih dari rekomendasi {hasil.selisih_tarif > 0 ? '+' : ''}{rupiah(hasil.selisih_tarif)}</>}</li>
              </ul>
            )}
          {hasil.di_luar_kamus.length > 0 && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Tidak ada di kamus aplikasi (tetap disimpan): {hasil.di_luar_kamus.join(', ')}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Tersimpan dan dipelajari untuk kasus berikutnya.</p>
        </div>
      )}
    </form>
  );
}

export function AgenCasemixPanel({ recordId, onOpenPdf }: { recordId: string; onOpenPdf?: (page: number) => void }) {
  const [hasil, setHasil] = useState<{ recordId: string; data: Laporan | null; gagal: boolean } | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  const [terbuka, setTerbuka] = useState(false);
  const [pesan, setPesan] = useState<{ recordId: string; daftar: Pesan[] }>({ recordId, daftar: [] });
  const [masukan, setMasukan] = useState('');
  const [menunggu, setMenunggu] = useState(false);
  const akhirChat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recordId) return;
    let aktif = true;
    api.getLaporanCasemix<Laporan>(recordId)
      .then((data: Laporan) => { if (aktif) setHasil({ recordId, data, gagal: false }); })
      .catch(() => { if (aktif) setHasil({ recordId, data: null, gagal: true }); });
    return () => { aktif = false; };
  }, [recordId, percobaan]);

  const daftarPesan = pesan.recordId === recordId ? pesan.daftar : [];
  useEffect(() => { akhirChat.current?.scrollIntoView({ block: 'nearest' }); }, [daftarPesan.length]);

  const status = hasil?.recordId !== recordId ? 'memuat' : hasil.gagal ? 'gagal' : 'siap';
  const data = status === 'siap' ? hasil!.data : null;

  async function kirim(teks: string) {
    const tanya = teks.trim();
    if (!tanya || menunggu) return;
    const riwayat = daftarPesan.map(p => ({ peran: p.peran, isi: p.isi }));
    setPesan({ recordId, daftar: [...daftarPesan, { peran: 'koder', isi: tanya }] });
    setMasukan('');
    setMenunggu(true);
    try {
      const r = await api.tanyaAgenCasemix<{jawaban:string;rujukan:Pesan['rujukan'];biaya_idr?:number}>(recordId, tanya, riwayat);
      setPesan(p => ({ recordId, daftar: [...p.daftar, { peran: 'agen', isi: r.jawaban, rujukan: r.rujukan, biaya: r.biaya_idr }] }));
    } catch {
      setPesan(p => ({ recordId, daftar: [...p.daftar, { peran: 'agen', isi: 'Agen belum dapat menjawab. Coba lagi.' }] }));
    } finally {
      setMenunggu(false);
    }
  }

  if (status === 'memuat') {
    return <div role="status" className="space-y-2 rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">Agen casemix menyusun laporan…</p><div aria-hidden="true" className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" /></div>;
  }
  if (status === 'gagal' || !data) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <p className="text-sm text-destructive">Laporan agen casemix belum dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => { setHasil(null); setPercobaan(n => n + 1); }}>Coba lagi</Button>
      </div>
    );
  }

  const jejak = data.jejak_kerja || { langkah: [], total_biaya_ai_idr: 0 };
  const jumlahTanya = data.pertanyaan_klarifikasi.length;

  return (
    <section aria-label="Agen casemix" className={cn('space-y-3 rounded-lg border p-4', WARNA_STATUS[data.status])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agen casemix · rujukan{data.keputusan_casemix ? ' · keputusan casemix RS tercatat' : ''}</p>
            <h4 className="font-semibold">
              {LABEL_STATUS[data.status]}
              {data.alternatif_koding.dasar.inacbg && <> · <span className="font-mono-data">{data.alternatif_koding.dasar.inacbg}</span> {rupiah(data.alternatif_koding.dasar.tarif)}</>}
            </h4>
            {data.ringkasan_klinis.narasi && <p className="mt-1 text-sm text-foreground/85">{data.ringkasan_klinis.narasi}</p>}
            {jumlahTanya > 0 && !terbuka && <p className="mt-1 text-sm text-foreground/85">{jumlahTanya} pertanyaan klarifikasi untuk dokter/koder.</p>}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0" aria-expanded={terbuka} onClick={() => setTerbuka(v => !v)}>
          {terbuka ? 'Ringkas' : 'Lihat laporan'}
        </Button>
      </div>

      {terbuka && (
        <div className="space-y-3">
          <Bagian judul="Rekomendasi koding">
            <ul className="space-y-2">
              {data.rekomendasi_koding.map(r => (
                <li key={`${r.jenis}-${r.kode}`} className="space-y-1.5 rounded-md bg-background/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-data font-semibold">{r.kode}</span>
                    <span className="text-muted-foreground">{r.jenis === 'prosedur' ? 'prosedur' : r.peran}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', WARNA_KODE[r.status])}>{LABEL_KODE[r.status]}</span>
                  </div>
                  {r.deskripsi && <p className="text-xs text-muted-foreground">{r.deskripsi}</p>}
                  {r.alasan && <p className="text-foreground/85">{r.alasan}</p>}
                  {r.bukti.length > 0 && (
                    <ul className="space-y-1">
                      {r.bukti.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-xs"><span className="italic">&ldquo;{b.kutipan}&rdquo;</span><Hal halaman={b.halaman} onOpenPdf={onOpenPdf} /></li>
                      ))}
                    </ul>
                  )}
                  {r.ketidakpastian.length > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">Belum ada: {r.ketidakpastian.join('; ')}</p>}
                </li>
              ))}
            </ul>
          </Bagian>

          {data.pelajaran_casemix?.length > 0 && (
            <Bagian judul="Pelajaran dari keputusan casemix RS (kasus lain)">
              <ul className="space-y-1 text-sm">
                {data.pelajaran_casemix.map((p, i) => <li key={i} className="flex gap-2"><GraduationCap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{p.pesan}</li>)}
              </ul>
            </Bagian>
          )}

          {jumlahTanya > 0 && (
            <Bagian judul="Pertanyaan klarifikasi">
              <ul className="space-y-1.5 text-sm">
                {data.pertanyaan_klarifikasi.map((q, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{q.untuk}</span><span>{q.pertanyaan}</span><Hal halaman={q.halaman} onOpenPdf={onOpenPdf} /></li>
                ))}
              </ul>
            </Bagian>
          )}

          {data.kondisi_tersirat.length > 0 && (
            <Bagian judul="Kondisi tersirat (bukan kode — tanyakan ke dokter)">
              <ul className="space-y-1 text-sm">
                {data.kondisi_tersirat.map((k, i) => <li key={i} className="flex flex-wrap items-center gap-2">{k.kondisi} <span className="text-xs italic text-muted-foreground">&ldquo;{k.kutipan}&rdquo;</span><Hal halaman={k.halaman} onOpenPdf={onOpenPdf} /></li>)}
              </ul>
            </Bagian>
          )}

          {data.persyaratan.length > 0 && (
            <Bagian judul="Persyaratan klaim">
              <ul className="space-y-1.5 text-sm">
                {data.persyaratan.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{LABEL_SYARAT[s.status]}</span> · {s.syarat}
                    <span className="block text-xs text-muted-foreground">
                      {s.regulasi ? `${s.regulasi.judul}${s.regulasi.versi ? ` (versi ${s.regulasi.versi})` : ''}${s.regulasi.berlaku ? '' : ' — tidak berlaku'}` : s.sumber}
                    </span>
                  </li>
                ))}
              </ul>
            </Bagian>
          )}

          {data.alternatif_koding.alternatif.length > 0 && (
            <Bagian judul="Alternatif koding yang sah">
              <ul className="space-y-1.5 text-sm">
                {data.alternatif_koding.alternatif.map((a, i) => (
                  <li key={i} className="rounded-md bg-background/60 p-2.5">
                    <p>{a.judul}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono-data">{a.inacbg}</span> {rupiah(a.tarif)}
                      {a.selisih_tarif != null && <> · selisih {a.selisih_tarif >= 0 ? '+' : ''}{rupiah(a.selisih_tarif)}</>} · {a.syarat}
                    </p>
                  </li>
                ))}
              </ul>
            </Bagian>
          )}

          {data.kronologi.length > 0 && (
            <Bagian judul="Kronologi pelayanan">
              <ol className="space-y-1 text-sm">
                {data.kronologi.map((k, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-data text-xs text-muted-foreground">{k.tanggal}{k.jam ? ` ${k.jam}` : ''}</span>{k.peristiwa}<Hal halaman={k.halaman} onOpenPdf={onOpenPdf} />
                  </li>
                ))}
              </ol>
            </Bagian>
          )}

          {jejak.langkah.length > 0 && (
            <Bagian judul={jejak.sumber === 'orkestrator' ? `Jejak kerja agen (sejak OCR selesai${jejak.durasi_detik ? `, ${jejak.durasi_detik} detik` : ''})` : 'Jejak kerja'}>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {jejak.langkah.map((l, i) => (
                  <li key={i}>
                    {l.oleh && <span className="mr-1 rounded bg-muted px-1 py-px font-medium uppercase text-foreground/70">{l.oleh}</span>}
                    {l.nama}: {l.status?.replace(/_/g, ' ') || '—'}{l.biaya_idr ? ` · ${rupiah(l.biaya_idr)}` : ''}{l.keterangan ? ` · ${l.keterangan}` : ''}
                  </li>
                ))}
              </ul>
              {jejak.total_biaya_ai_idr > 0 && <p className="text-xs text-muted-foreground">Total biaya AI: {rupiah(jejak.total_biaya_ai_idr)}</p>}
            </Bagian>
          )}

          <Bagian judul="Keputusan casemix final">
            <KeputusanCasemixForm key={recordId} recordId={recordId} laporan={data} onTersimpan={() => setPercobaan(n => n + 1)} />
          </Bagian>

          <p className="text-xs text-muted-foreground">{data.catatan}</p>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tanya agen casemix</h5>
        {daftarPesan.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {CONTOH_TANYA.map(c => <Button key={c} type="button" variant="outline" size="sm" className="h-auto min-h-8 whitespace-normal text-left text-xs" onClick={() => kirim(c)} disabled={menunggu}>{c}</Button>)}
          </div>
        )}
        {daftarPesan.length > 0 && (
          <div className="max-h-96 space-y-2 overflow-y-auto" aria-live="polite">
            {daftarPesan.map((p, i) => (
              <div key={i} className={cn('rounded-md p-3 text-sm', p.peran === 'koder' ? 'ml-6 bg-primary/10' : 'mr-6 bg-background/70')}>
                <p className="whitespace-pre-line">{p.isi}</p>
                {p.rujukan && p.rujukan.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.rujukan.map((r, j) => <li key={j} className="flex flex-wrap items-center gap-2 text-xs"><span className="italic">&ldquo;{r.kutipan}&rdquo;</span><Hal halaman={r.halaman} onOpenPdf={onOpenPdf} /></li>)}
                  </ul>
                )}
                {p.biaya != null && p.biaya > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Biaya AI {rupiah(p.biaya)}</p>}
              </div>
            ))}
            {menunggu && <p role="status" className="mr-6 text-sm text-muted-foreground">Agen membaca berkas…</p>}
            <div ref={akhirChat} />
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); kirim(masukan); }}>
          <Textarea
            value={masukan}
            onChange={e => setMasukan(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim(masukan); } }}
            placeholder="Tanyakan kode, bukti, tarif, atau minta draf jawaban pending…"
            aria-label="Pertanyaan untuk agen casemix"
            rows={2}
            maxLength={1000}
            className="min-h-[2.5rem] flex-1 resize-none text-sm"
          />
          <Button type="submit" size="sm" className="min-h-10" disabled={menunggu || !masukan.trim()} aria-label="Kirim pertanyaan"><Send aria-hidden="true" className="size-4" /></Button>
        </form>
        <p className="text-[11px] text-muted-foreground">Jawaban agen berdasarkan berkas ini dan dapat keliru; rujukan halaman sudah dicocokkan dengan berkas. Agen tidak mengubah data klaim.</p>
      </div>
    </section>
  );
}
