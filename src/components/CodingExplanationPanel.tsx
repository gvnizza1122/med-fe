'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCodingExplanation,
  type CodingExplanation,
  type CodingExplanationResult,
  type CodeEvidenceEntry,
} from '@/lib/generateCodingExplanation';

interface CodingExplanationPanelProps {
  codeString: string; // e.g., "J45.9;I10"
  fieldType: 'diagnosis' | 'procedure';
  // 'review' ditambah 19 Sep 2026 (fix item 8/9) -- field DIAGLIST/PROCLIST
  // yang punya code_evidence dengan review_status perlu_review/evidence_
  // tidak_terverifikasi (lihat buildFieldMap di halaman hasil).
  status: 'valid' | 'approved' | 'review' | 'empty' | 'error';
  clinicalFindings?: Record<string, any>;
  pageReference?: string; // e.g., "Resume Medis hal. 2"
  codeEvidence?: CodeEvidenceEntry[]; // Data dari ai_review.code_evidence
  className?: string;
}

// generateCodingExplanation() hanya menerima status 'valid'|'approved' --
// 'review' dipetakan ke 'valid' di sini SEBELUM dipanggil (badge/label
// "Perlu Review" yang sebenarnya ditentukan oleh review_status PER KODE dari
// codeEvidence, bukan dari status field-level ini, lihat hasReviewFlag di bawah).
function toExplanationStatus(status: CodingExplanationPanelProps['status']): 'valid' | 'approved' {
  return status === 'approved' ? 'approved' : 'valid';
}

/**
 * Panel untuk menampilkan penjelasan kode diagnosis/prosedur yang valid/disetujui
 * Format: collapsible accordion dengan bullet points
 *
 * Contoh output untuk J45.9 (Valid):
 * ▸ Lihat Penjelasan (1 kode)
 *   ▾ Lihat Penjelasan (1 kode)
 *   • Asthma, unspecified (WHO ICD-10 2010)
 *   • Penyakit sesak nafas jangka panjang
 *   • Temuan: ronchi bilateral = obstruksi saluran napas
 *   • Tercatat di Resume Medis hal. 2
 *   • Status: Valid
 */
export function CodingExplanationPanel({
  codeString,
  fieldType,
  status,
  clinicalFindings,
  pageReference,
  codeEvidence,
  className
}: CodingExplanationPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Jangan tampilkan panel kalau status bukan valid/approved/review atau kode kosong
  if (status !== 'valid' && status !== 'approved' && status !== 'review') return null;
  if (!codeString || codeString.trim() === '') return null;

  // Generate explanation
  const result = generateCodingExplanation(
    codeString,
    fieldType,
    toExplanationStatus(status),
    clinicalFindings,
    pageReference,
    codeEvidence
  );

  if (!result.isComplete || result.codes.length === 0) return null;

  // Fix item 8/9 (19 Sep 2026): badge header WAJIB ikut review_status
  // per-kode kalau ADA kode yang backend tandai perlu_review/evidence_tidak_
  // terverifikasi -- jangan biarkan tetap "Valid" cuma karena `status` prop
  // (field-level, dari rule engine) belum tahu soal review_flags ini.
  const hasReviewFlag = result.codes.some(c => c.reviewStatus === 'perlu_review' || c.reviewStatus === 'evidence_tidak_terverifikasi');
  const statusLabel = hasReviewFlag ? 'Perlu Review' : status === 'approved' ? 'Disetujui' : 'Valid';
  const statusColor = hasReviewFlag
    ? 'text-amber-600 dark:text-amber-400'
    : status === 'approved'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-blue-600 dark:text-blue-400';

  return (
    <div className={cn('mt-2.5 rounded-md border border-dashed', className)}>
      {/* Header Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium text-muted-foreground">
          Penjelasan Kode
        </span>
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', statusColor)}>
          {statusLabel}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {result.codes.length} {result.codes.length === 1 ? 'kode' : 'kode'}
        </span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-dashed px-2.5 py-2 space-y-3">
          {result.codes.map((explanation) => (
            <ExplanationItem
              key={explanation.code}
              explanation={explanation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Single explanation item (satu kode)
 */
function ExplanationItem({
  explanation
}: {
  explanation: CodingExplanation;
}) {
  return (
    <div className="space-y-1.5">
      {/* Kode + Label */}
      <div className="flex items-center gap-2">
        <div className="font-mono font-bold text-xs text-foreground">
          {explanation.code}
        </div>
        <span className="text-[10px] text-muted-foreground italic">
          {explanation.type === 'diagnosis' ? '(Diagnosis)' : '(Prosedur)'}
        </span>
      </div>

      {/* Bullet Points */}
      <ul className="space-y-0.5 text-[11px] text-foreground/85">
        {explanation.explanationBullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2 ml-2">
            <span className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">•</span>
            <span className={
              // Highlight deskripsi resmi + status
              bullet.includes('WHO') || bullet.includes('Status:')
                ? 'font-semibold'
                : ''
            }>
              {bullet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Simplified version untuk inline display (tanpa collapsible)
 * Dipakai kalau space terbatas
 */
export function CodingExplanationBadge({
  codeString,
  fieldType,
  status,
  clinicalFindings,
  pageReference
}: Omit<CodingExplanationPanelProps, 'className'>) {
  if (status !== 'valid' && status !== 'approved') return null;
  if (!codeString || codeString.trim() === '') return null;

  const result = generateCodingExplanation(
    codeString,
    fieldType,
    status,
    clinicalFindings,
    pageReference
  );

  if (!result.isComplete || result.codes.length === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
        status === 'approved'
          ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
          : 'bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'
      )}
      title={result.summary}
    >
      <CheckCircle2 className="size-3" />
      {result.codes.length} kode {status === 'approved' ? 'disetujui' : 'valid'}
    </div>
  );
}

/**
 * Tooltip version untuk display minimalis
 */
export function CodingExplanationTooltip({
  codeString,
  fieldType,
  status,
  clinicalFindings,
  pageReference
}: Omit<CodingExplanationPanelProps, 'className'>) {
  if (status !== 'valid' && status !== 'approved') return null;
  if (!codeString || codeString.trim() === '') return null;

  const result = generateCodingExplanation(
    codeString,
    fieldType,
    status,
    clinicalFindings,
    pageReference
  );

  if (!result.isComplete || result.codes.length === 0) return null;

  const tooltipText = result.codes
    .map(code => `${code.code}: ${code.description}`)
    .join('\n');

  return (
    <div
      className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 cursor-help"
      title={tooltipText}
    >
      <AlertCircle className="size-3" />
      <span>Lihat penjelasan</span>
    </div>
  );
}
