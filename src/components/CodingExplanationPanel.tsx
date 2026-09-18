'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateCodingExplanation,
  type CodingExplanation,
  type CodingExplanationResult
} from '@/lib/generateCodingExplanation';

interface CodingExplanationPanelProps {
  codeString: string; // e.g., "J45.9;I10"
  fieldType: 'diagnosis' | 'procedure';
  status: 'valid' | 'approved' | 'empty' | 'error';
  clinicalFindings?: Record<string, any>;
  pageReference?: string; // e.g., "Resume Medis hal. 2"
  className?: string;
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
  className
}: CodingExplanationPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Jangan tampilkan panel kalau status bukan valid/approved atau kode kosong
  if (status !== 'valid' && status !== 'approved') return null;
  if (!codeString || codeString.trim() === '') return null;

  // Generate explanation
  const result = generateCodingExplanation(
    codeString,
    fieldType,
    status,
    clinicalFindings,
    pageReference
  );

  if (!result.isComplete || result.codes.length === 0) return null;

  const statusLabel = status === 'approved' ? 'Disetujui' : 'Valid';
  const statusColor = status === 'approved'
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
