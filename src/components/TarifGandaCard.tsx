'use client';
/**
 * Tarif INA-CBG dan iDRG berdampingan, plus koding versi iDRG.
 *
 * RS menagih dengan iDRG, tetapi sebagian klaim masih INA-CBG -- keduanya
 * ditampilkan supaya koder tahu angka mana yang dipakai. Kartu ini hanya
 * MELAPORKAN (backend tarifGandaService); tidak mengubah data klaim.
 *
 * Tarif iDRG = Cost Weight x National Base Rate. Kode DRG dan cost weight
 * hanya dikeluarkan grouper iDRG Kemenkes (di E-Klaim), jadi selama berkas
 * belum memuat lembar hasil grouper iDRG, tarifnya ditampilkan "belum dapat
 * dihitung" -- tidak pernah ditebak.
 */
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface KodeIdrg {
  kode: string;
  status: 'im' | 'perlu_dipilih' | 'perlu_verifikasi' | 'sama' | 'tidak_dikenal';
  catatan?: string;
  kode_idrg: string | null;
  deskripsi: string | null;
  padanan_inacbg: string | null;
  kandidat: { kode: string; deskripsi: string }[];
}
interface TarifGanda {
  jenis_klaim: string | null;
  inacbg: {
    resmi: { sumber: 'lembar_grouper_eklaim' | 'data_klaim'; kode: string; deskripsi: string | null; tarif: number | null; versi_eklaim: string | null; halaman: number | null } | null;
    hitungan_medaudit: { kode: string; deskripsi: string | null; tarif: number | null; catatan: string | null; alasan?: string | null } | null;
    perkiraan_klaim?: { kode: string; deskripsi: string | null; tarif: number | null; catatan: string | null; alasan?: string | null; status: 'tersedia' | 'tarif_belum_tersedia'; label: string; keterangan: string } | null;
    cocok: boolean | null;
  };
  idrg: {
    status: 'tersedia' | 'belum_dapat_dihitung';
    sumber: string | null;
    drg: string | null;
    deskripsi: string | null;
    cost_weight: number | null;
    nbr: { nilai: number | null; jenis: string; status: string };
    tarif: number | null;
    rumus: string;
    alasan?: string;
    verifikasi_rumus?: boolean | null;
  };
  koding_idrg: {
    diagnosis: KodeIdrg[];
    prosedur: KodeIdrg[];
    lengkap: boolean;
    catatan: string[];
    sumber_kamus_im?: { catatan?: string };
  };
}

const rupiah = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const LABEL_SUMBER_INACBG: Record<string, string> = {
  lembar_grouper_eklaim: 'Lembar grouper E-Klaim (resmi)',
  data_klaim: 'Data klaim E-Klaim',
};

const STATUS_KODE: Record<KodeIdrg['status'], { label: string; kelas: string }> = {
  im: { label: 'Entri kamus IM', kelas: 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' },
  sama: { label: 'Kode dasar tersedia', kelas: 'border-border bg-secondary/40 text-foreground' },
  perlu_verifikasi: { label: 'Verifikasi padanan di E-Klaim', kelas: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  perlu_dipilih: { label: 'Verifikasi versi iDRG', kelas: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
  tidak_dikenal: { label: 'Tidak dikenal', kelas: 'border-red-600/30 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' },
};

function BarisKode({ k }: { k: KodeIdrg }) {
  const gaya = STATUS_KODE[k.status];
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono-data text-sm font-semibold">{k.kode}</span>
        <span aria-hidden className="text-muted-foreground">→</span>
        <span className="font-mono-data text-sm">{k.kode_idrg ?? '?'}</span>
        <Badge variant="outline" className={cn('text-[11px] font-medium', gaya.kelas)}>{gaya.label}</Badge>
      </div>
      {k.deskripsi && <p className="mt-0.5 text-xs text-muted-foreground">{k.deskripsi}</p>}
      {k.status === 'im' && k.padanan_inacbg && (
        <p className="mt-0.5 text-xs text-muted-foreground">Padanan INA-CBG: <span className="font-mono-data">{k.padanan_inacbg}</span></p>
      )}
      {k.catatan && <p className="mt-1 text-xs text-muted-foreground">{k.catatan}</p>}
      {k.status === 'perlu_dipilih' && (
        <div className="mt-1 text-xs text-muted-foreground">
          <p>Daftar lama perlu dicocokkan dengan definisi kode dan bukti klinis di E-Klaim:</p>
          <ul className="mt-1 space-y-0.5">
            {k.kandidat.map(c => (
              <li key={c.kode}><span className="font-mono-data text-foreground">{c.kode}</span> — {c.deskripsi}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export function TarifGandaCard({ recordId }: { recordId: string }) {
  const [data, setData] = useState<TarifGanda | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    setData(null); setGalat(null);
    api.getTarifGanda(recordId)
      .then((d: TarifGanda) => { if (!batal) setData(d); })
      .catch((e: Error) => { if (!batal) setGalat(e.message || 'Tarif gagal dimuat'); });
    return () => { batal = true; };
  }, [recordId]);

  if (galat) return <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{galat}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Memuat tarif INA-CBG dan iDRG…</p>;

  const { inacbg, idrg, koding_idrg: koding } = data;
  const semuaKode = [...koding.diagnosis, ...koding.prosedur];
  const perkiraan = inacbg.perkiraan_klaim ?? inacbg.hitungan_medaudit;

  return (
    <section aria-label="Tarif INA-CBG dan iDRG" className="space-y-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
        {/* INA-CBG */}
        <article className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perkiraan klaim kasus ini</p>
          <p className="mt-1 text-xs text-muted-foreground">INA-CBG · Berdasarkan diagnosis dan prosedur kasus ini</p>
          {perkiraan ? (
            <>
              <p className="mt-2 font-display text-2xl font-semibold">{perkiraan.tarif == null ? 'Tarif belum dapat diperkirakan' : rupiah(perkiraan.tarif)}</p>
              <p className="mt-1 text-sm"><span className="font-mono-data font-semibold">{perkiraan.kode}</span>{perkiraan.deskripsi && <span className="text-muted-foreground"> · {perkiraan.deskripsi}</span>}</p>
              {perkiraan.alasan && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Dasar perkiraan: {perkiraan.alasan}</p>}
              {perkiraan.catatan && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Rincian dasar tarif</summary><p className="mt-1 leading-relaxed">{perkiraan.catatan}</p></details>}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{inacbg.perkiraan_klaim?.keterangan ?? 'Nilai ini merupakan perkiraan aplikasi dan perlu verifikasi dengan hasil E-Klaim.'}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Perkiraan klaim belum dapat dihitung dari data kasus ini.</p>
          )}
          {inacbg.resmi ? (
            <div className="mt-3 border-t border-border pt-3 text-xs">
              <p className="font-medium">Hasil E-Klaim sebagai pembanding</p>
              <p className="mt-1"><span className="font-mono-data">{inacbg.resmi.kode}</span> · {rupiah(inacbg.resmi.tarif)}</p>
              <p className="mt-1 text-muted-foreground">Sumber: {LABEL_SUMBER_INACBG[inacbg.resmi.sumber] ?? inacbg.resmi.sumber}{inacbg.resmi.halaman ? `, halaman ${inacbg.resmi.halaman}` : ''}{inacbg.resmi.versi_eklaim ? ` · E-Klaim ${inacbg.resmi.versi_eklaim}` : ''}</p>
              {inacbg.cocok === true && <p className="mt-1 text-emerald-700 dark:text-emerald-400">Kode perkiraan sama dengan hasil E-Klaim.</p>}
              {inacbg.cocok === false && <p className="mt-1 text-amber-700 dark:text-amber-400">Kode perkiraan berbeda; tinjau diagnosis, prosedur dan aturan grouper.</p>}
            </div>
          ) : perkiraan && (
            <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">Hasil E-Klaim untuk pembanding belum tersedia.</p>
          )}
        </article>

        {/* iDRG */}
        <article className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarif iDRG</p>
          {idrg.status === 'tersedia' ? (
            <>
              <p className="mt-1 font-display text-2xl font-semibold">{rupiah(idrg.tarif)}</p>
              <p className="mt-1 text-sm"><span className="font-mono-data font-semibold">{idrg.drg}</span>{idrg.deskripsi && <span className="text-muted-foreground"> · {idrg.deskripsi}</span>}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                CW {idrg.cost_weight ?? '—'} × NBR {rupiah(idrg.nbr.nilai)} · Sumber: {idrg.sumber === 'data_klaim' ? 'ekspor data klaim E-Klaim' : 'lembar grouper iDRG E-Klaim'}
              </p>
              {idrg.verifikasi_rumus === false && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Tarif pada ekspor berbeda dari hasil CW × NBR. Periksa hasil E-Klaim dan komponennya.</p>}
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-lg font-semibold text-muted-foreground">Belum dapat dihitung</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/85">{idrg.alasan}</p>
            </>
          )}
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            {idrg.rumus}. NBR {idrg.nbr.jenis === 'rawat_inap' ? 'rawat inap' : 'rawat jalan'}: {rupiah(idrg.nbr.nilai)}
            {idrg.nbr.status === 'rancangan_kemenkes' ? ' (angka rancangan Kemenkes, bisa berubah)' : ''}.
          </p>
        </article>
      </div>

      {/* Koding versi iDRG */}
      {semuaKode.length > 0 && (
        <article className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Koding versi iDRG</h4>
            <Badge variant="outline" className="text-[11px]">{koding.lengkap ? 'Entri kamus ditemukan' : 'Perlu ditinjau'}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pencocokan kode dengan kamus yang tersedia. Kemiripan awalan kode belum membuktikan padanan; verifikasi di E-Klaim sesuai diagnosis dan tindakan dalam resume.
          </p>
          {koding.diagnosis.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Diagnosis</p>
              <ul className="mt-1 divide-y divide-border">{koding.diagnosis.map(k => <BarisKode key={`d-${k.kode}`} k={k} />)}</ul>
            </>
          )}
          {koding.prosedur.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Prosedur</p>
              <ul className="mt-1 divide-y divide-border">{koding.prosedur.map(k => <BarisKode key={`p-${k.kode}`} k={k} />)}</ul>
            </>
          )}
          {koding.catatan.length > 0 && (
            <ul className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
              {koding.catatan.map(c => <li key={c}>• {c}</li>)}
            </ul>
          )}
          {koding.sumber_kamus_im?.catatan && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Kamus IM: {koding.sumber_kamus_im.catatan}</p>
          )}
        </article>
      )}
    </section>
  );
}
