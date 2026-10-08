'use client';
/**
 * Bagian "Pemeriksaan penunjang" di bawah pemeriksaan khusus: pemeriksaan yang
 * sudah dilakukan ke pasien (laboratorium, CTG, EKG, radiologi, ...) dan hasil
 * laboratorium per parameter. Disusun backend dari halaman berkas
 * (pemeriksaanPenunjangService) tanpa AI.
 */
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Peran = 'hasil' | 'permintaan' | 'tagihan' | 'catatan';
interface BuktiPenunjang { halaman: number; kutipan: string | null; peran: Peran }
interface Pemeriksaan {
  id: string; nama: string; kategori: string | null;
  kode_icd9: string | null; deskripsi_icd9: string | null;
  ada_hasil: boolean; bukti: BuktiPenunjang[];
  // Butir gabungan "Pemeriksaan laboratorium darah": rincian & kode lain.
  komponen?: string[];
  // Histopatologi: kesimpulan PA dan sifatnya.
  hasil_ringkas?: string | null;
  sifat?: 'jinak' | 'ganas' | null;
  kode_lain?: { kode: string; deskripsi: string | null; untuk: string }[];
}
interface BarisLab {
  parameter: string; ditulis: string; hasil: string; satuan: string | null; rujukan: string | null;
  flag: string | null; status: 'tinggi' | 'rendah' | 'normal' | null; perlu_cek: boolean; dikenali: boolean; kutipan: string;
}
interface HalamanLab { halaman: number; tanggal: string | null; kelompok: { nama: string; baris: BarisLab[] }[] }
interface DataPenunjang {
  pemeriksaan: Pemeriksaan[];
  laboratorium: HalamanLab[];
  ringkasan: { jumlah_pemeriksaan: number; jumlah_parameter_lab: number; jumlah_di_luar_rujukan: number };
}

const LABEL_PERAN: Record<Peran, string> = {
  hasil: 'Hasil',
  permintaan: 'Tercatat di resume',
  tagihan: 'Tagihan',
  catatan: 'Disebut',
};

function TombolHalaman({ halaman, onOpenPdf }: { halaman: number; onOpenPdf?: (page: number) => void }) {
  if (!onOpenPdf) return <span className="text-xs text-muted-foreground">hal. {halaman}</span>;
  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => onOpenPdf(halaman)}>
      <FileText aria-hidden="true" className="size-3.5" />Hal. {halaman}
    </Button>
  );
}

export function PemeriksaanPenunjangPanel({ recordId, onOpenPdf, tertanam = false }: {
  recordId: string;
  onOpenPdf?: (page: number) => void;
  // true = disisipkan di kartu pemeriksaan fisik (tanpa padding sendiri).
  tertanam?: boolean;
}) {
  const ruang = tertanam ? '' : 'p-4 sm:p-5';
  // Hasil disimpan bersama ID record-nya (pola sama dengan SaranKodingPanel):
  // selama ID belum cocok, statusnya "memuat" tanpa setState sinkron di effect.
  const [hasil, setHasil] = useState<{ recordId: string; data: DataPenunjang | null; gagal: boolean } | null>(null);
  const [percobaan, setPercobaan] = useState(0);
  // Ringkas secara bawaan: satu baris ringkasan, rincian dibuka bila perlu.
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    let aktif = true;
    api.getPemeriksaanPenunjang<DataPenunjang>(recordId)
      .then((data: DataPenunjang) => { if (aktif) setHasil({ recordId, data, gagal: false }); })
      .catch(() => { if (aktif) setHasil({ recordId, data: null, gagal: true }); });
    return () => { aktif = false; };
  }, [recordId, percobaan]);

  const status = hasil?.recordId !== recordId ? 'memuat' : hasil.gagal ? 'gagal' : 'siap';
  const data = status === 'siap' ? hasil!.data : null;

  if (status === 'memuat') {
    return <div role="status" className={cn('space-y-3', ruang)}><p className="text-sm text-muted-foreground">Menyusun pemeriksaan penunjang…</p><div aria-hidden="true" className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" /></div>;
  }
  if (status === 'gagal' || !data) {
    return <div role="alert" className={cn('space-y-3', ruang)}><p className="text-sm text-destructive">Pemeriksaan penunjang belum dapat dimuat.</p><Button variant="outline" size="sm" onClick={() => { setHasil(null); setPercobaan(n => n + 1); }}>Coba lagi</Button></div>;
  }

  const kosong = data.pemeriksaan.length === 0 && data.laboratorium.length === 0;
  if (kosong) {
    return <p className={cn('text-sm text-muted-foreground', ruang)}>Belum ada pemeriksaan penunjang yang terbaca dari berkas.</p>;
  }

  const { jumlah_parameter_lab: jumlahParameter, jumlah_di_luar_rujukan: diLuar } = data.ringkasan;
  return (
    <div className={cn('space-y-4', ruang)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Pemeriksaan penunjang</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Ringkasan pemeriksaan">
            {data.pemeriksaan.map(p => (
              <li key={p.id} className={cn('rounded-full border px-2.5 py-0.5 text-xs', p.ada_hasil ? 'border-border text-foreground/90' : 'border-amber-500/40 text-amber-800 dark:text-amber-300')}>
                {p.id === 'lab_darah' ? 'Lab darah' : p.id === 'histopatologi' ? 'Histopatologi' : p.nama}
                {p.kode_icd9 && <span className="ml-1 font-mono-data text-muted-foreground">{p.kode_icd9}</span>}
                {!p.ada_hasil && <span className="ml-1">· hasil belum terkonfirmasi</span>}
              </li>
            ))}
            {jumlahParameter > 0 && (
              <li className={cn('rounded-full px-2.5 py-0.5 text-xs', diLuar > 0 ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
                {jumlahParameter} parameter lab{diLuar > 0 ? ` · ${diLuar} di luar rujukan` : ' · semua dalam rujukan'}
              </li>
            )}
          </ul>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0" aria-expanded={terbuka} onClick={() => setTerbuka(v => !v)}>
          {terbuka ? 'Ringkas' : 'Lihat rincian'}
        </Button>
      </div>

      {terbuka && <>
      <section aria-label="Pemeriksaan yang dilakukan" className="space-y-3">
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.pemeriksaan.map(p => (
            <li key={p.id} className="space-y-2 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{p.nama}</p>
                  {p.kode_icd9 && (
                    <p className="text-sm text-muted-foreground">
                      <code className="font-mono-data text-foreground/90">{p.kode_icd9}</code>
                      {p.deskripsi_icd9 && <span> {p.deskripsi_icd9}</span>}
                    </p>
                  )}
                  {p.hasil_ringkas && (
                    <p className="mt-1 text-sm text-foreground/90">
                      Kesimpulan: {p.hasil_ringkas}
                      {p.sifat && (
                        <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs font-semibold', p.sifat === 'ganas' ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
                          {p.sifat === 'ganas' ? 'Ganas' : 'Tidak ganas'}
                        </span>
                      )}
                    </p>
                  )}
                  {p.komponen && p.komponen.length > 0 && (
                    <p className="mt-1 text-sm text-foreground/80">Meliputi: {p.komponen.join(', ')}</p>
                  )}
                  {p.kode_lain && p.kode_lain.length > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.kode_icd9 ? 'Kode lain' : 'Kode ICD-9-CM'}: {p.kode_lain.map(k => `${k.kode}${k.deskripsi ? ` ${k.deskripsi}` : ''} (${k.untuk})`).join('; ')}
                    </p>
                  )}
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  p.ada_hasil ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                )}>
                  {p.ada_hasil ? 'Ada hasil' : 'Hasil belum dilampirkan'}
                </span>
              </div>
              <ul className="space-y-1.5">
                {p.bukti.map((b, i) => (
                  <li key={`${b.halaman}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-36 shrink-0 text-muted-foreground">{LABEL_PERAN[b.peran]}</span>
                    <TombolHalaman halaman={b.halaman} onOpenPdf={onOpenPdf} />
                    {b.kutipan && <span className="min-w-0 break-words text-foreground/80">“{b.kutipan}”</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {data.laboratorium.map(h => (
        <details key={h.halaman} className="group space-y-3 rounded-lg border border-border p-3 sm:p-4">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground">Hasil laboratorium <span className="text-sm font-normal text-primary group-open:hidden">· tampilkan tabel</span></h4>
              <p className="text-sm text-muted-foreground">
                {h.tanggal ? `Tanggal ${h.tanggal} · ` : ''}{h.kelompok.reduce((n, k) => n + k.baris.length, 0)} parameter
              </p>
            </div>
            <TombolHalaman halaman={h.halaman} onOpenPdf={onOpenPdf} />
          </summary>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Parameter</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Hasil</th>
                  <th scope="col" className="px-3 py-2 font-medium">Satuan</th>
                  <th scope="col" className="px-3 py-2 font-medium">Rujukan</th>
                </tr>
              </thead>
              {h.kelompok.map((k, ki) => (
                <tbody key={`${k.nama}-${ki}`} className="border-t border-border">
                  <tr><th scope="rowgroup" colSpan={4} className="bg-muted/20 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.nama}</th></tr>
                  {k.baris.map((b, i) => {
                    const luar = b.status === 'tinggi' || b.status === 'rendah';
                    return (
                      <tr key={`${k.nama}-${i}`} className="border-t border-border/60">
                        <th scope="row" className="px-3 py-1.5 text-left font-normal text-foreground">
                          {b.parameter}
                          {b.ditulis !== b.parameter && <span className="ml-1.5 text-xs text-muted-foreground">({b.ditulis})</span>}
                        </th>
                        <td className={cn('px-3 py-1.5 text-right font-mono-data tabular-nums', luar ? 'font-semibold text-red-700 dark:text-red-400' : 'text-foreground')}>
                          {b.hasil}
                          {luar && <span className="ml-1 text-xs">{b.status === 'tinggi' ? '↑' : '↓'}<span className="sr-only">{b.status === 'tinggi' ? ' tinggi' : ' rendah'}</span></span>}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{b.satuan || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{b.rujukan || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Dibaca dari lembar hasil (OCR). Nama parameter dalam kurung adalah tulisan asli pada berkas; cocokkan dengan PDF bila ragu.</p>
        </details>
      ))}
      </>}
    </div>
  );
}
