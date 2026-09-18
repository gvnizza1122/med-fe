/**
 * Claim Validation Workflow
 *
 * Integrasi validasi koherensi klinis SEBELUM grouping INA-CBG + lookup
 * tarif. Berbeda dari `claimSuggestionWorkflow.ts` (yang fokus ke suggestion
 * step 3-7 dan berasumsi data sudah valid), file ini adalah GATE di depan:
 *
 * 1. Ekstrak diagnosis + prosedur + tanda vital + temuan klinis dari record
 * 2. Panggil `validateClinicalCoherence()` (lihat clinicalCoherenceValidator.ts)
 * 3. Kalau koheren -> jalankan INA-CBG grouping -> lookup tarif
 * 4. Kalau TIDAK koheren -> tandai PENDING, isu koherensi masuk ke
 *    `ai_review.pending_reasons` (fail-safe: JANGAN lanjut grouping/tarif
 *    kalau datanya sendiri belum masuk akal secara klinis)
 */

import {
  validateClinicalCoherence,
  type ClinicalCoherenceInput,
  type VitalSigns,
} from '../services/clinicalCoherenceValidator';
import { lookupTariff, type TariffLookupResult } from '../services/tariffLookupService';
import { groupToInaCbg, type InaCbgGroupResult } from './inaCbgGroupingService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RecordStatus = 'READY' | 'PENDING';

/**
 * Data record yang sudah diekstrak dari dokumen, siap divalidasi.
 * Field teks (diagnosis_utama, alasan_masuk, dst.) dipakai untuk cek
 * koherensi klinis; field kode (diagnosisCodes/procedureCodes) dipakai
 * untuk grouping INA-CBG kalau koherensi lolos.
 */
export interface ClaimValidationInput extends ClinicalCoherenceInput {
  recordId: string;
  diagnosisCodes: string[]; // kode ICD-10, dipakai untuk grouping
  procedureCodes: string[]; // kode ICD-9, dipakai untuk grouping
  serviceType: 'RAWAT_JALAN' | 'RAWAT_INAP';
  kelasRs?: 'A' | 'B' | 'C' | 'D';
}

export interface AiReviewPendingUpdate {
  pending_reasons: string[];
}

export interface ClaimValidationResult {
  record_status: RecordStatus;
  inacbg_result: InaCbgGroupResult | null;
  tariff_result: TariffLookupResult | null;
  coherence_issues: string[];
  ai_review: AiReviewPendingUpdate;
}

// ============================================================================
// AI_REVIEW MERGE HELPER
// ============================================================================

/**
 * Gabungkan `pending_reasons` baru ke object `ai_review` yang sudah ada
 * (mis. berisi `code_evidence`/`pending_risk_notes` dari tahap AI review
 * lain) tanpa menghapus key lain. Dipakai kalau caller sudah punya
 * `ai_review` existing dari record dan cuma perlu menambahkan alasan
 * pending dari cek koherensi klinis.
 */
export function mergePendingReasonsIntoAiReview<T extends Record<string, unknown>>(
  existingAiReview: T | undefined,
  pendingReasons: string[]
): T & AiReviewPendingUpdate {
  const base = (existingAiReview ?? {}) as T;
  const previousReasons = Array.isArray((base as Record<string, unknown>).pending_reasons)
    ? ((base as Record<string, unknown>).pending_reasons as string[])
    : [];

  return {
    ...base,
    pending_reasons: [...previousReasons, ...pendingReasons],
  };
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

/**
 * Jalankan validasi koherensi klinis, lalu (kalau lolos) grouping INA-CBG
 * + lookup tarif. Fail-safe: kalau koherensi gagal, grouping/tarif TIDAK
 * dijalankan dan record ditandai PENDING.
 */
export async function runClaimValidationWorkflow(
  input: ClaimValidationInput
): Promise<ClaimValidationResult> {
  const coherence = validateClinicalCoherence({
    diagnosis_utama: input.diagnosis_utama,
    diagnosis_sekunder: input.diagnosis_sekunder,
    prosedur: input.prosedur,
    alasan_masuk: input.alasan_masuk,
    vital_signs: input.vital_signs,
    clinical_findings: input.clinical_findings,
  });

  if (!coherence.isCoherent) {
    return {
      record_status: 'PENDING',
      inacbg_result: null,
      tariff_result: null,
      coherence_issues: coherence.issues,
      ai_review: { pending_reasons: coherence.issues },
    };
  }

  const inacbgResult = await groupToInaCbg(input.diagnosisCodes, input.procedureCodes, {
    serviceType: input.serviceType,
    kelasRs: input.kelasRs,
  });

  const tariffResult = lookupTariff(inacbgResult.inacbg_code, { kelasRs: input.kelasRs });

  return {
    record_status: 'READY',
    inacbg_result: inacbgResult,
    tariff_result: tariffResult,
    coherence_issues: [],
    ai_review: { pending_reasons: [] },
  };
}

// Re-export vital signs type for convenience of callers building input objects.
export type { VitalSigns };
