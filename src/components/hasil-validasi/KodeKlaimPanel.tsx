'use client';
// Tab "Data Klaim" di kolom kanan: diagnosis utama, diagnosis sekunder, dan
// prosedur yang tercatat di klaim, masing-masing dengan judul kamus dan
// kutipan bukti dari dokumen (ai_review.code_evidence). Hanya dibaca; kode
// diubah lewat "Edit Data" supaya validasi backend tetap satu pintu.
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { DOCUMENT_TYPE_LABELS, type DocumentType } from '@/lib/generateCodingExplanation';
import { cn } from '@/lib/utils';

export interface BuktiKode {
  code: string;
  type: 'diagnosis' | 'procedure';
  found?: boolean;
  evidence_found?: boolean;
  page_number: number | null;
  quotation: string | null;
  document_type?: DocumentType | null;
  dictionary_status?: 'valid' | 'not_found' | 'unavailable';
  review_status?: 'VALID' | 'PENDING';
  coding_review_status?: 'VALID' | 'PENDING';
  diganti_menjadi?: string;
}

const normal = (kode: string) => kode.trim().toUpperCase().replace(/\s+/g, '');
const tanpaTitik = (kode: string) => normal(kode).replace(/\./g, '');

export function pecahKode(nilai: unknown): string[] {
  return String(nilai ?? '').split(/[;,]/).map(k => k.trim()).filter(Boolean);
}

export function cariBukti(bukti: BuktiKode[], kode: string, jenis: BuktiKode['type']): BuktiKode | undefined {
  const k = tanpaTitik(kode);
  return bukti.find(b => b.type === jenis && tanpaTitik(b.code) === k);
}

export function adaBukti(b?: BuktiKode): boolean {
  return Boolean(b && (b.evidence_found ?? b.found) && b.quotation);
}

type StatusKode = { teks: string; ikon: typeof CheckCircle2; kelas: string };

function statusKode(b?: BuktiKode): StatusKode {
  if (b?.dictionary_status === 'not_found') {
    return { teks: 'Di luar kamus', ikon: XCircle, kelas: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' };
  }
  if (b && (b.review_status === 'PENDING' || b.coding_review_status === 'PENDING')) {
    return { teks: 'Perlu dicek', ikon: AlertTriangle, kelas: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300' };
  }
  if (adaBukti(b)) {
    const dok = b?.document_type ? DOCUMENT_TYPE_LABELS[b.document_type] : null;
    return { teks: dok && b?.document_type !== 'lainnya' ? `Sesuai ${dok}` : 'Ada di dokumen', ikon: CheckCircle2, kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' };
  }
  return { teks: 'Bukti belum ditemukan', ikon: CircleHelp, kelas: 'bg-muted text-foreground/80' };
}

function BarisKode({ kode, judul, bukti, utama, onOpenPdf }: {
  kode: string; judul?: string; bukti?: BuktiKode; utama?: boolean; onOpenPdf?: (halaman: number) => void;
}) {
  const s = statusKode(bukti);
  const Ikon = s.ikon;
  const halaman = bukti?.page_number ?? null;
  const dok = bukti?.document_type ? DOCUMENT_TYPE_LABELS[bukti.document_type] : 'Dokumen';
  return (
    <li className={cn('rounded-lg border border-border bg-card p-3', utama && 'border-primary/30 bg-primary/[0.03] p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className={cn('rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono-data font-semibold text-foreground', utama ? 'text-xl' : 'text-sm')}>{kode}</span>
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold', s.kelas)}>
          <Ikon aria-hidden="true" className="size-3.5" />{s.teks}
        </span>
      </div>
      <p className={cn('mt-2 text-foreground', utama ? 'text-base font-medium' : 'text-sm')}>
        {judul || <span className="text-muted-foreground">Judul kode tidak ditemukan di kamus</span>}
      </p>
      {bukti?.diganti_menjadi && <p className="mt-1 text-xs text-muted-foreground">Diganti menjadi <span className="font-mono-data">{bukti.diganti_menjadi}</span></p>}
      {adaBukti(bukti) && (
        <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">
          {dok}{halaman ? ` · Hal. ${halaman}` : ''}: “{bukti?.quotation}”
          {halaman && onOpenPdf && (
            <button type="button" onClick={() => onOpenPdf(halaman)} className="ml-1.5 not-italic font-medium text-primary underline underline-offset-2 hover:no-underline">
              Lihat
            </button>
          )}
        </p>
      )}
    </li>
  );
}

function Bagian({ judul, lencana, children }: { judul: string; lencana: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">{judul}</h3>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">{lencana}</span>
      </div>
      {children}
    </section>
  );
}

export function KodeKlaimPanel({ diagnosis, prosedur, bukti, onOpenPdf }: {
  diagnosis: string[]; prosedur: string[]; bukti: BuktiKode[]; onOpenPdf?: (halaman: number) => void;
}) {
  const [judul, setJudul] = useState<{ diagnosis: Record<string, string>; procedure: Record<string, string> }>({ diagnosis: {}, procedure: {} });
  const kunciDiagnosis = diagnosis.join(';');
  const kunciProsedur = prosedur.join(';');
  useEffect(() => {
    if (!kunciDiagnosis && !kunciProsedur) return;
    let batal = false;
    api.lookupCodeDescriptions(pecahKode(kunciDiagnosis), pecahKode(kunciProsedur))
      .then(hasil => { if (!batal) setJudul(hasil); })
      .catch(() => { /* judul kamus opsional; kode tetap tampil */ });
    return () => { batal = true; };
  }, [kunciDiagnosis, kunciProsedur]);

  const judulDari = (peta: Record<string, string>, kode: string) => peta[kode] ?? peta[normal(kode)];
  const [utama, ...sekunder] = diagnosis;

  return (
    <div className="space-y-5">
      <Bagian judul="Diagnosis utama (ICD-10)" lencana={utama ? '1 kode' : 'Kosong'}>
        {utama ? (
          <ul><BarisKode utama kode={utama} judul={judulDari(judul.diagnosis, utama)} bukti={cariBukti(bukti, utama, 'diagnosis')} onOpenPdf={onOpenPdf} /></ul>
        ) : (
          <p className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-300">Diagnosis utama belum terisi. Lengkapi lewat Edit Data atau lihat tab Saran AI.</p>
        )}
      </Bagian>
      <Bagian judul="Diagnosis sekunder" lencana={`${sekunder.length} kode`}>
        {sekunder.length ? (
          <ul className="space-y-2">
            {sekunder.map((kode, i) => <BarisKode key={`${kode}-${i}`} kode={kode} judul={judulDari(judul.diagnosis, kode)} bukti={cariBukti(bukti, kode, 'diagnosis')} onOpenPdf={onOpenPdf} />)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Tidak ada diagnosis sekunder.</p>}
      </Bagian>
      <Bagian judul="Prosedur / tindakan (ICD-9-CM)" lencana={`${prosedur.length} kode`}>
        {prosedur.length ? (
          <ul className="space-y-2">
            {prosedur.map((kode, i) => <BarisKode key={`${kode}-${i}`} kode={kode} judul={judulDari(judul.procedure, kode)} bukti={cariBukti(bukti, kode, 'procedure')} onOpenPdf={onOpenPdf} />)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Belum ada kode prosedur. Alasannya dijelaskan di Analisis Risiko.</p>}
      </Bagian>
    </div>
  );
}
