'use client';
/**
 * INA-CBG & Tarif Display
 * Compact, info-dense card showing the diagnosis/prosedur codes proposed for
 * grouping, the resulting INA-CBG group, and the looked-up tariff. Mirrors the
 * visual language already used by InaCbgDashboardCard (dark theme, mono codes,
 * "USULAN" evidence chips with hover-for-quotation) but is a self-contained,
 * strongly-typed component that takes pre-computed grouping/tariff results as
 * props instead of parsing raw record data.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { rentangTarif, SkenarioSeverityTarif } from './SkenarioSeverityTarif';

interface Evidence {
  quotation: string;
  page_number: number;
}

interface InaCbgResult {
  code: string;
  description: string;
  confidence: number; // 0..1
  reasoning?: string;
  severity_estimasi?: boolean;
  base_perlu_verifikasi?: boolean;
  kandidat_base?: { base: string; prosedur: string | null }[];
}

interface TariffResult {
  // Nama field WAJIB sama persis dengan yang dikirim backend
  // (aiReviewService.js: tarifResult). Sebelumnya di sini tertulis
  // tariff_amount, padahal backend tidak pernah mengirim nama itu --
  // akibatnya hasTariff SELALU false dan panel ini SELALU menampilkan
  // "Tidak ditemukan", berapa pun tarif yang berhasil dihitung backend.
  amount: number | null; // Rp, null kalau tarif tidak berlaku
  note?: string; // alasan spesifik saat amount null
  region: string; // e.g. "Regional 1"
  class: string; // e.g. "D"
  source: string; // e.g. "PMK 3/2023"
  perlu_verifikasi_grouper?: boolean;
  skenario_severity?: { code: string; severity: string; amount: number | null }[];
}

interface InaCbgTarifDisplayProps {
  diagnosis_code: string;
  diagnosis_evidence?: Evidence;
  prosedur_code: string;
  prosedur_evidence?: Evidence;

  inacbg_result: InaCbgResult;
  tariff_result: TariffResult;

  className?: string;
}

const CONFIDENCE_HIGH = 0.9;
const CONFIDENCE_LOW = 0.7;

function formatRupiah(amount: number): string {
  return amount.toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  });
}

/** "Regional 1" -> "Reg 1" (keeps whatever was passed if it doesn't match) */
function shortenRegion(region: string): string {
  const match = region?.match(/regional\s*(\d+)/i);
  return match ? `Reg ${match[1]}` : region || '—';
}

// ============================================================================
// EvidenceBadge — "○ USULAN" pill with the supporting quotation + page ref.
// Hover shows the full quotation via the native title tooltip, matching the
// pattern already used for usulan chips elsewhere in this feature area.
// ============================================================================

function EvidenceBadge({ evidence }: { evidence?: Evidence }) {
  if (!evidence) {
    return <span className="text-xs text-gray-500">—</span>;
  }

  return (
    <span
      title={`Hal. ${evidence.page_number}: "${evidence.quotation}"`}
      className={cn(
        'inline-flex max-w-[280px] items-center gap-1.5 rounded-full border',
        'border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5',
        'text-[11px] font-medium text-emerald-400 cursor-help'
      )}
    >
      <span className="shrink-0 text-emerald-500">○</span>
      <span className="shrink-0 font-semibold">USULAN</span>
      <span className="shrink-0 text-emerald-700">:</span>
      <span className="truncate italic text-emerald-300/90">
        &ldquo;{evidence.quotation}&rdquo;
      </span>
      <span className="shrink-0 text-emerald-600">(hal. {evidence.page_number})</span>
    </span>
  );
}

// ============================================================================
// CodeDisplay — one diagnosis/prosedur row: label + mono code + evidence badge
// ============================================================================

function CodeDisplay({
  label,
  code,
  description,
  evidence,
  withBorder = true,
}: {
  label: string;
  code: string;
  description?: string;
  evidence?: Evidence;
  withBorder?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-12 items-center gap-2 px-4 py-2',
        withBorder && 'border-b border-white/5'
      )}
    >
      <div className="col-span-3 text-sm font-semibold text-gray-100">{label}</div>
      {/* Kode dan namanya sebaris, sama seperti tabel Diagnosis & Prosedur. */}
      <div className="col-span-6 flex min-w-0 items-baseline gap-x-2 text-sm leading-relaxed">
        <code className="shrink-0 font-mono font-semibold text-gray-200">{code || '—'}</code>
        {code && description && (
          <span className="min-w-0 break-words text-gray-300" title={description}>
            {description}
          </span>
        )}
      </div>
      <div className="col-span-3 flex justify-end">
        <EvidenceBadge evidence={evidence} />
      </div>
    </div>
  );
}

// ============================================================================
// TariffSection — INA-CBG group header (code + description) and the looked-up
// tariff amount + region/class/source, laid out side by side.
// ============================================================================

function TariffSection({
  inacbg_result,
  tariff_result,
}: {
  inacbg_result: InaCbgResult;
  tariff_result: TariffResult;
}) {
  const confidence = inacbg_result?.confidence ?? 0;
  const isHighConfidence = confidence >= CONFIDENCE_HIGH;
  const isLowConfidence = confidence < CONFIDENCE_LOW;

  const hasTariff = !!tariff_result && Number(tariff_result.amount) > 0;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-base font-bold text-purple-300">
            {inacbg_result?.severity_estimasi ? inacbg_result.code.replace(/-I$/,'') : inacbg_result?.code || '—'}
          </span>
          {isHighConfidence && (
            <CheckCircle2
              className="size-3.5 shrink-0 text-green-500"
              aria-label="Confidence tinggi"
            />
          )}
          {isLowConfidence && (
            <AlertTriangle
              className="size-3.5 shrink-0 text-amber-500"
              aria-label="Confidence rendah — perlu diperiksa"
            />
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-400" title={inacbg_result?.description}>
          {inacbg_result?.severity_estimasi ? inacbg_result.description.replace(/\s*\((?:RINGAN|SEDANG|BERAT)\)/ig,'') : inacbg_result?.description || '—'}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-base font-bold text-gray-100">
          {inacbg_result.severity_estimasi ? rentangTarif(tariff_result?.skenario_severity) || 'Lihat skenario tarif' : hasTariff ? formatRupiah(Number(tariff_result.amount)) : 'Tidak ditemukan'}
        </div>
        {hasTariff && (
          <div className="mt-0.5 text-[11px] text-gray-500">
            {shortenRegion(tariff_result.region)}
            {tariff_result.class ? ` - Kelas ${tariff_result.class}` : ''}
            {tariff_result.source ? ` · ${tariff_result.source}` : ''}
          </div>
        )}
        {!hasTariff && tariff_result?.note && (
          <div className="mt-0.5 max-w-[260px] text-[11px] leading-snug text-gray-500">
            {tariff_result.note}
          </div>
        )}
      </div>
      {(inacbg_result.severity_estimasi || tariff_result?.perlu_verifikasi_grouper) && (
        <div className="w-full rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
          <p className="font-semibold">{inacbg_result.severity_estimasi ? 'Perkiraan tarif menurut severity' : 'Perkiraan kelompok rawat jalan'}</p>
          <p className="mt-1">{inacbg_result.severity_estimasi
            ? 'Bandingkan ketiga skenario berikut. Tingkat final mengikuti pengelompokan E-Klaim untuk diagnosis dan prosedur pada episode ini.'
            : 'Tarif mengikuti tabel resmi untuk kelompok yang diperkirakan aplikasi. Kesesuaian kelompok perlu diverifikasi dengan mesin E-Klaim.'}</p>
          {inacbg_result.reasoning && <p className="mt-2 text-muted-foreground">{inacbg_result.reasoning}</p>}
          {inacbg_result.base_perlu_verifikasi && !!inacbg_result.kandidat_base?.length && (
            <div className="mt-2">
              <p className="font-medium">Tabel menyediakan beberapa kandidat. Cocokkan dengan pelayanan yang terdokumentasi.</p>
              <ul className="mt-1 space-y-1">
                {inacbg_result.kandidat_base.map(k => <li key={k.base}>
                  <code>{k.base}</code>{k.prosedur ? ` · prosedur ${k.prosedur}` : ' · bukti jenis layanan perlu diperiksa'}
                </li>)}
              </ul>
            </div>
          )}
          <div className="mt-3"><SkenarioSeverityTarif skenario={tariff_result?.skenario_severity} /></div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// InaCbgTarifDisplay
// ============================================================================

export function InaCbgTarifDisplay({
  diagnosis_code,
  diagnosis_evidence,
  prosedur_code,
  prosedur_evidence,
  inacbg_result,
  tariff_result,
  className,
}: InaCbgTarifDisplayProps) {
  // Keterangan kamus ICD-10 WHO / ICD-9-CM dari backend (bukan AI). Hanya
  // kode yang dikirim; kode yang tidak dikenal kamus dibiarkan tanpa keterangan.
  const [descriptions, setDescriptions] = useState<{ diagnosis: Record<string, string>; procedure: Record<string, string> }>({ diagnosis: {}, procedure: {} });
  const diagnosisKey = (diagnosis_code || '').trim().toUpperCase();
  const procedureKey = (prosedur_code || '').trim().toUpperCase();
  useEffect(() => {
    if (!diagnosisKey && !procedureKey) return;
    let active = true;
    api.lookupCodeDescriptions(diagnosisKey ? [diagnosisKey] : [], procedureKey ? [procedureKey] : [])
      .then(result => { if (active) setDescriptions(result); })
      .catch(() => { /* panel tetap tampil tanpa keterangan */ });
    return () => { active = false; };
  }, [diagnosisKey, procedureKey]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-emerald-900/50 bg-gray-950/40',
        className
      )}
    >
      <CodeDisplay
        label="Diagnosis"
        code={diagnosis_code}
        description={descriptions.diagnosis?.[diagnosisKey]}
        evidence={diagnosis_evidence}
      />
      <CodeDisplay
        label="Prosedur"
        code={prosedur_code}
        description={descriptions.procedure?.[procedureKey]}
        evidence={prosedur_evidence}
        withBorder={false}
      />
      <div className="border-t border-white/5">
        <TariffSection inacbg_result={inacbg_result} tariff_result={tariff_result} />
      </div>
    </div>
  );
}

// ============================================================================
// InaCbgTarifPending — fallback message for when clinical coherence hasn't
// passed yet / grouping or tariff lookup hasn't succeeded. Kept in this file
// so callers don't have to invent their own copy for the "otherwise" branch.
// ============================================================================

export function InaCbgTarifPending({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3',
        className
      )}
    >
      <p className="text-xs font-medium text-amber-200/90">
        <span className="font-bold text-amber-500">Pending verifikasi.</span>{' '}
        Grouping INA-CBG dan tarif belum bisa ditampilkan. Cek kembali kesesuaian
        klinis (diagnosis, prosedur, dan resume medis) sebelum kode ini disetujui.
         .
      </p>
    </div>
  );
}

export default InaCbgTarifDisplay;
