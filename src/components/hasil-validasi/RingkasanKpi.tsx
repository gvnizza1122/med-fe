'use client';
// Tiga kartu ringkas di bawah kepala pasien. Angka di sini adalah hitungan
// (jumlah rekam, jumlah kode yang buktinya ditemukan, jumlah alasan pending),
// BUKAN persentase keyakinan AI -- itu sengaja tidak pernah ditampilkan.
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileStack, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type Nada = 'baik' | 'perhatian' | 'bahaya' | 'netral';

const NADA: Record<Nada, { kotak: string; ikon: string; lencana: string }> = {
  baik: {
    kotak: 'border-emerald-500/30 bg-emerald-500/[0.04]',
    ikon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    lencana: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  perhatian: {
    kotak: 'border-amber-500/40 bg-amber-500/[0.04]',
    ikon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    lencana: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
  },
  bahaya: {
    kotak: 'border-red-500/30 bg-red-500/[0.04]',
    ikon: 'bg-red-500/10 text-red-700 dark:text-red-400',
    lencana: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  },
  netral: {
    kotak: 'border-border bg-card',
    ikon: 'bg-muted text-muted-foreground',
    lencana: 'bg-muted text-foreground/80',
  },
};

function KartuKpi({ ikon, judul, nilai, keterangan, lencana, nada }: {
  ikon: ReactNode; judul: string; nilai: ReactNode; keterangan?: string; lencana?: string; nada: Nada;
}) {
  const gaya = NADA[nada];
  return (
    <div className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-4', gaya.kotak)}>
      <div aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', gaya.ikon)}>{ikon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{judul}</p>
        <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground">
          {nilai}
          {keterangan && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{keterangan}</span>}
        </p>
      </div>
      {lencana && <span className={cn('shrink-0 rounded-md px-2 py-1 text-xs font-semibold', gaya.lencana)}>{lencana}</span>}
    </div>
  );
}

const LABEL_RISIKO: Record<string, { lencana: string; nada: Nada }> = {
  berisiko_pending: { lencana: 'Berisiko pending', nada: 'bahaya' },
  perlu_dicek: { lencana: 'Perlu dicek', nada: 'perhatian' },
  tidak_ditemukan_alasan: { lencana: 'Tidak ada temuan', nada: 'baik' },
};

export function RingkasanKpi({ totalRekam, rekamValid, kodeDiagnosis, risiko }: {
  totalRekam: number;
  rekamValid: number;
  kodeDiagnosis: { terbukti: number; total: number };
  risiko: { status: string | null; jumlahAlasan: number; jumlahBerat: number };
}) {
  const semuaValid = totalRekam > 0 && rekamValid === totalRekam;
  const diagLengkap = kodeDiagnosis.total > 0 && kodeDiagnosis.terbukti === kodeDiagnosis.total;
  const gayaRisiko = risiko.status ? LABEL_RISIKO[risiko.status] : undefined;
  return (
    <section aria-label="Ringkasan berkas" className="grid gap-3 @3xl:grid-cols-3">
      <KartuKpi
        ikon={<FileStack className="size-5" />}
        judul="Rekam dalam berkas"
        nilai={`${totalRekam} SEP`}
        keterangan={`${rekamValid} valid`}
        lencana={semuaValid ? 'Semua valid' : `${totalRekam - rekamValid} belum valid`}
        nada={semuaValid ? 'baik' : 'perhatian'}
      />
      <KartuKpi
        ikon={diagLengkap ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        judul="Bukti kode diagnosis"
        nilai={kodeDiagnosis.total === 0 ? 'Belum ada kode' : `${kodeDiagnosis.terbukti} dari ${kodeDiagnosis.total} kode`}
        lencana={kodeDiagnosis.total === 0 ? 'Perlu dikode' : diagLengkap ? 'Ada di dokumen' : 'Perlu dicek'}
        nada={kodeDiagnosis.total === 0 ? 'perhatian' : diagLengkap ? 'baik' : 'perhatian'}
      />
      <KartuKpi
        ikon={<ShieldAlert className="size-5" />}
        judul="Risiko pending BPJS"
        nilai={gayaRisiko ? `${risiko.jumlahAlasan} alasan` : 'Belum dianalisis'}
        keterangan={risiko.jumlahBerat > 0 ? `${risiko.jumlahBerat} berat` : undefined}
        lencana={gayaRisiko?.lencana}
        nada={gayaRisiko?.nada ?? 'netral'}
      />
    </section>
  );
}
