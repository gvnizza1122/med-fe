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
  status: 'im' | 'perlu_dipilih' | 'sama' | 'tidak_dikenal';
  kode_idrg: string | null;
  deskripsi: string | null;
  padanan_inacbg: string | null;
  kandidat: { kode: string; deskripsi: string }[];
}
interface TarifGanda {
  jenis_klaim: string | null;
  inacbg: {
    resmi: { sumber: 'lembar_grouper_eklaim' | 'data_klaim'; kode: string; deskripsi: string | null; tarif: number | null; versi_eklaim: string | null; halaman: number | null } | null;
    hitungan_medaudit: { kode: string; deskripsi: string | null; tarif: number | null; catatan: string | null } | null;
    cocok: boolean | null;
  };
  idrg: {
    status: 'tersedia' | 'belum_dapat_dihitung';
    sumber: string | null;
    drg: string | null;
    deskripsi: string | null;
    cost_weight: number | null;
    nbr: { nilai: number; jenis: string; status: string };
    tarif: number | null;
    rumus: string;
    alasan?: string;
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
  im: { label: 'Kode iDRG (IM)', kelas: 'border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' },
  sama: { label: 'Sama di iDRG', kelas: 'border-border bg-secondary/40 text-foreground' },
  perlu_dipilih: { label: 'Pilih versi iDRG', kelas: 'border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
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
      {k.status === 'perlu_dipilih' && (
        <div className="mt-1 text-xs text-muted-foreground">
          <p>iDRG memakai kode yang lebih rinci. Pilih sesuai isi resume:</p>
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

  return (
    <section aria-label="Tarif INA-CBG dan iDRG" className="space-y-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
        {/* INA-CBG */}
        <article className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarif INA-CBG</p>
          {inacbg.resmi ? (
            <>
              <p className="mt-1 font-display text-2xl font-semibold">{rupiah(inacbg.resmi.tarif)}</p>
              <p className="mt-1 text-sm"><span className="font-mono-data font-semibold">{inacbg.resmi.kode}</span>{inacbg.resmi.deskripsi && <span className="text-muted-foreground"> · {inacbg.resmi.deskripsi}</span>}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Sumber: {LABEL_SUMBER_INACBG[inacbg.resmi.sumber] ?? inacbg.resmi.sumber}
                {inacbg.resmi.halaman ? `, halaman ${inacbg.resmi.halaman}` : ''}
                {inacbg.resmi.versi_eklaim ? ` · E-Klaim ${inacbg.resmi.versi_eklaim}` : ''}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Belum ada hasil grouper INA-CBG di berkas atau data klaim.</p>
          )}
          {inacbg.hitungan_medaudit && (
            <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
              Hitungan medaudit: <span className="font-mono-data text-foreground">{inacbg.hitungan_medaudit.kode}</span> · {rupiah(inacbg.hitungan_medaudit.tarif)}
              {inacbg.cocok === true && <span className="ml-1 text-emerald-700 dark:text-emerald-400">(sama dengan grouper)</span>}
              {inacbg.cocok === false && <span className="ml-1 text-amber-700 dark:text-amber-400">(berbeda dari grouper — periksa koding)</span>}
            </div>
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
                CW {idrg.cost_weight} × NBR {rupiah(idrg.nbr.nilai)} · Sumber: lembar grouper iDRG E-Klaim
              </p>
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
            <Badge variant="outline" className="text-[11px]">{koding.lengkap ? 'Siap untuk iDRG' : 'Perlu ditinjau'}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Kode klaim (kiri) dan padanannya di iDRG (kanan). Hasil konversi otomatis dari kamus — bukan hasil grouper, tetap cocokkan dengan resume.
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
