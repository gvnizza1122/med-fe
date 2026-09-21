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

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Evidence {
  quotation: string;
  page_number: number;
}

interface InaCbgResult {
  code: string;
  description: string;
  confidence: number; // 0..1
  reasoning?: string;
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
  evidence,
  withBorder = true,
}: {
  label: string;
  code: string;
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
      <div className="col-span-3 text-center font-mono text-sm text-gray-200">
        {code || '—'}
      </div>
      <div className="col-span-6 flex justify-end">
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
    <div className="flex items-start justify-between gap-4 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-base font-bold text-purple-300">
            {inacbg_result?.code || '—'}
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
          {inacbg_result?.description || '—'}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-base font-bold text-gray-100">
          {hasTariff ? formatRupiah(Number(tariff_result.amount)) : 'Tidak ditemukan'}
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
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-emerald-900/50 bg-gray-950/40',
        className
      )}
    >
      <CodeDisplay label="Diagnosis" code={diagnosis_code} evidence={diagnosis_evidence} />
      <CodeDisplay
        label="Prosedur"
        code={prosedur_code}
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
