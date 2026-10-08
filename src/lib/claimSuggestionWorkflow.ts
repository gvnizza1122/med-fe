/**
 * Claim Suggestion Workflow
 * Integration of INA-CBG grouping as step 3 of the verification workflow.
 *
 * Workflow steps:
 * 1. Extract record data (diagnosis, procedure, vital signs)
 * 2. Validate extracted fields
 * 3. [DETERMINISTIC] Group to INA-CBG using diagnosis + procedure
 * 4. [TARIFF LOOKUP] Fetch tariff from INA-CBG master data
 * 5. Calculate claim amount & copay
 * 6. Detect special rules (PRB, RV-13/15/16, CMG restrictions)
 * 7. Generate suggestions & warnings
 *
 * This file demonstrates integration at step 3.
 */

import {
groupClaimToCmg,
type ClaimGroupingInput,
type GroupingResult
} from './inaCbgGroupingService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Raw record data extracted from PDF/SIMRS
 */
export interface ExtractedRecord {
  recordId: string;
  patientName: string;
  medicalRecordNumber: string;
  admissionDate: string;
  dischargeDate?: string;
  serviceType: 'RAWAT_JALAN' | 'RAWAT_INAP';
  diagnosisCodes: string[]; // Primary + secondary diagnoses
  procedureCodes: string[]; // All procedures performed
  clinicalFindings?: {
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    severity?: 'mild' | 'moderate' | 'severe';
  };
}

/**
 * Tariff data from INA-CBG master (would come from external API/DB)
 */
export interface TariffData {
  cmgCode: string; // e.g., 'K-4-17'
  description: string;
  baseTariff: number; // IDR
  kelasA: number;
  kelasB: number;
  kelasC: number;
  kelasD: number;
  topUpAllowed: boolean;
  topUpPercentage?: number;
}

/**
 * Complete workflow suggestion result
 */
export interface SuggestionResult {
  recordId: string;
  step1_validation: {
    valid: boolean;
    errors?: string[];
  };
  step3_grouping: GroupingResult;
  step4_tariff?: {
    found: boolean;
    data?: TariffData;
    error?: string;
  };
  step5_calculation?: {
    baseClaim: number;
    topUp?: number;
    totalClaim: number;
    copayPercentage: number;
    copayAmount: number;
  };
  step6_specialRules?: {
    prb?: { detected: boolean; reason?: string };
    klassRestriction?: { klasD: boolean; message?: string };
    permanentSuspect?: string[];
  };
  step7_suggestions: Suggestion[];
  overallConfidence: number;
}

/**
 * Individual suggestion for user action
 */
export interface Suggestion {
  type: 'INFO' | 'WARNING' | 'ERROR' | 'CORRECTION';
  category: string;
  title: string;
  description: string;
  suggestedValue?: string | number;
  currentValue?: string | number;
  action?: 'APPLY' | 'REVIEW' | 'CONTACT_IT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  affectsAmount: boolean;
  reference?: string; // e.g., PMK 3/2023 hal. 45
}

// ============================================================================
// STEP 3: INA-CBG GROUPING (Deterministic)
// ============================================================================

/**
 * Step 3: Determine INA-CBG group from diagnosis + procedure
 * This is deterministic — same input always produces same output.
 * No AI, no "best guess" — pure rule matching.
 */
export async function groupRecordToInaChg(record: ExtractedRecord): Promise<GroupingResult> {
  const input: ClaimGroupingInput = {
    diagnosisCodes: record.diagnosisCodes,
    procedureCodes: record.procedureCodes,
    serviceType: record.serviceType,
    clinicalFindings: record.clinicalFindings,
    kelasRs: undefined, // Will be added in step 6 (special rules check)
  };

  return groupClaimToCmg(input);
}

// ============================================================================
// STEP 4: TARIFF LOOKUP (Mock implementation)
// ============================================================================

/**
 * Step 4: Look up tariff from INA-CBG master data
 * In production, this calls an API to /api/v1/tariffs/{cmgCode}
 */
export async function lookupTariff(cmgCode: string): Promise<TariffData | null> {
  // Mock tariff data - in production, fetch from DB/API
  const MOCK_TARIFFS: Record<string, TariffData> = {
    'J-3-13': {
      cmgCode: 'J-3-13',
      description: 'Asthma dengan spirometry',
      baseTariff: 850000,
      kelasA: 850000,
      kelasB: 720000,
      kelasC: 550000,
      kelasD: 450000,
      topUpAllowed: true,
      topUpPercentage: 25,
    },
    'K-4-17': {
      cmgCode: 'K-4-17',
      description: 'Tukak lambung rawat jalan',
      baseTariff: 620000,
      kelasA: 620000,
      kelasB: 525000,
      kelasC: 400000,
      kelasD: 320000,
      topUpAllowed: true,
      topUpPercentage: 20,
    },
  };

  const cmgPrefix = cmgCode.split('-').slice(0, 3).join('-');
  return MOCK_TARIFFS[cmgPrefix] || null;
}

// ============================================================================
// STEP 5: TARIFF CALCULATION
// ============================================================================

export interface TariffCalculationInput {
  tariff: TariffData;
  kelas: 'A' | 'B' | 'C' | 'D';
  topUpApplied: boolean;
}

export function calculateClaim(input: TariffCalculationInput): {
  baseClaim: number;
  topUp: number;
  totalClaim: number;
  copayPercentage: number;
  copayAmount: number;
} {
  const kelasMap = {
    A: input.tariff.kelasA,
    B: input.tariff.kelasB,
    C: input.tariff.kelasC,
    D: input.tariff.kelasD,
  };

  const baseClaim = kelasMap[input.kelas];
  let topUp = 0;

  if (input.topUpApplied && input.tariff.topUpAllowed && input.tariff.topUpPercentage) {
    topUp = baseClaim * (input.tariff.topUpPercentage / 100);
  }

  const totalClaim = baseClaim + topUp;
  const copayPercentage = 0.2; // Default 20% copay
  const copayAmount = totalClaim * copayPercentage;

  return {
    baseClaim,
    topUp,
    totalClaim,
    copayPercentage,
    copayAmount,
  };
}

// ============================================================================
// STEP 6: SPECIAL RULES DETECTION
// ============================================================================

export interface SpecialRulesCheckInput {
  groupingResult: GroupingResult;
  record: ExtractedRecord;
  kelas: 'A' | 'B' | 'C' | 'D';
}

export function checkSpecialRules(input: SpecialRulesCheckInput): {
  prb?: { detected: boolean; reason?: string };
  klasDRestriction?: { restricted: boolean; message?: string };
  permanentSuspect?: string[];
} {
  const result: ReturnType<typeof checkSpecialRules> = {};

  // Check Kelas D restrictions
  if (input.kelas === 'D' && input.groupingResult.klasD?.hasTopUp === false) {
    result.klasDRestriction = {
      restricted: true,
      message: input.groupingResult.klasD.warning,
    };
  }

  // Check for permanent suspicion triggers
  const suspects: string[] = [];

  // RV-13: DRG group change between same patient, same condition, different period
  // (would require multi-record comparison - simplified here)
  if (input.groupingResult.cmgCode === 'NON-CMG') {
    suspects.push('RV-13: CMG tidak terdeteksi dengan baik');
  }

  // Check PRB (Program Rujuk Balik) criteria
  const chronicDiagnoses = input.record.diagnosisCodes.filter(code =>
    /^(E1[0-4]|I1[0-5]|J44|N18|F32|F41)/.test(code)
  );
  if (chronicDiagnoses.length > 0 && input.record.serviceType === 'RAWAT_INAP') {
    result.prb = {
      detected: true,
      reason: `Penyakit kronis: ${chronicDiagnoses.join(', ')}`,
    };
  }

  if (suspects.length > 0) {
    result.permanentSuspect = suspects;
  }

  return result;
}

// ============================================================================
// STEP 7: SUGGESTION GENERATION
// ============================================================================

/**
 * Generate user-facing suggestions based on workflow results
 */
export function generateSuggestions(
  groupingResult: GroupingResult,
  tariffResult?: { found: boolean; data?: TariffData },
  specialRules?: Awaited<ReturnType<typeof checkSpecialRules>>
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // ========== Grouping Issues ==========
  if (groupingResult.confidence < 0.7) {
    suggestions.push({
      type: 'WARNING',
      category: 'Grouping',
      title: 'Kepercayaan Grouping Rendah',
      description: `Sistem hanya ${(groupingResult.confidence * 100).toFixed(0)}% yakin dengan CMG yang dipilih. Silakan periksa diagnosa dan prosedur secara manual.`,
      suggestedValue: groupingResult.inaCbgCode,
      action: 'REVIEW',
      priority: 'MEDIUM',
      affectsAmount: true,
      reference: 'PMK 3/2023 Bagian I',
    });
  }

  if (groupingResult.cmgCode === 'UNKNOWN') {
    suggestions.push({
      type: 'ERROR',
      category: 'Grouping',
      title: 'CMG Tidak Dapat Ditentukan',
      description: 'Diagnosa dan/atau prosedur tidak valid atau tidak ditemukan dalam tabel PMK 3/2023.',
      action: 'CONTACT_IT',
      priority: 'HIGH',
      affectsAmount: true,
    });
  }

  // ========== Severity Issues ==========
  if (groupingResult.severity && groupingResult.severity !== 'I') {
    suggestions.push({
      type: 'INFO',
      category: 'Severity',
      title: `CMG Level ${groupingResult.severity} (${groupingResult.severity === 'II' ? 'Sedang' : 'Berat'})`,
      description: `Temuan klinis menunjukkan tingkat keparahan ${
        groupingResult.severity === 'II' ? 'sedang' : 'berat'
      }. Tarif dapat disesuaikan.`,
      suggestedValue: groupingResult.inaCbgCode,
      action: 'REVIEW',
      priority: 'MEDIUM',
      affectsAmount: true,
    });
  }

  // ========== Tariff Lookup Issues ==========
  if (tariffResult && !tariffResult.found) {
    suggestions.push({
      type: 'WARNING',
      category: 'Tariff',
      title: 'CMG Tidak Ada di Master Tarif',
      description: `CMG "${groupingResult.inaCbgCode}" tidak ditemukan di master tarif. Periksa tabel PMK 3/2023 terbaru.`,
      action: 'CONTACT_IT',
      priority: 'HIGH',
      affectsAmount: true,
    });
  }

  // ========== Kelas D Top-up Restrictions ==========
  if (groupingResult.klasD?.hasTopUp === false) {
    suggestions.push({
      type: 'WARNING',
      category: 'Kelas D Restriction',
      title: 'Top-up Tidak Berlaku untuk Kelas D',
      description: groupingResult.klasD.warning || '',
      action: 'APPLY',
      priority: 'HIGH',
      affectsAmount: true,
      reference: 'PMK 3/2023 Bagian II',
    });
  }

  // ========== Special CMG Information ==========
  if (groupingResult.specialCmg?.type) {
    const typeMap = {
      'SP': 'Prosedur Pembedahan',
      'SR': 'Radiologi',
      'SI': 'Intervensi Non-Bedah',
      'SD': 'Dialisis',
      'SUBAKUT': 'Perawatan Subakut',
      'KRONIS': 'Kondisi Kronis',
    };

    suggestions.push({
      type: 'INFO',
      category: 'Special CMG',
      title: `Special CMG: ${typeMap[groupingResult.specialCmg.type]}`,
      description: groupingResult.specialCmg.reason || '',
      action: 'REVIEW',
      priority: 'LOW',
      affectsAmount: false,
    });
  }

  // ========== Special Rules (PRB, RV-13, etc) ==========
  if (specialRules?.prb?.detected) {
    suggestions.push({
      type: 'INFO',
      category: 'PRB',
      title: 'Potensi Program Rujuk Balik',
      description: specialRules.prb.reason || 'Pasien dengan penyakit kronis stabil mungkin memenuhi kriteria PRB.',
      action: 'REVIEW',
      priority: 'LOW',
      affectsAmount: false,
    });
  }

  if (specialRules?.permanentSuspect?.length) {
    specialRules.permanentSuspect.forEach(suspect => {
      suggestions.push({
        type: 'WARNING',
        category: 'Suspect',
        title: suspect.split(':')[0],
        description: suspect,
        action: 'REVIEW',
        priority: 'MEDIUM',
        affectsAmount: false,
      });
    });
  }

  return suggestions;
}

// ============================================================================
// COMPLETE WORKFLOW ORCHESTRATION
// ============================================================================

/**
 * Run the complete suggestion workflow (steps 1-7)
 */
export async function runClaimSuggestionWorkflow(
  record: ExtractedRecord,
  kelas: 'A' | 'B' | 'C' | 'D'
): Promise<SuggestionResult> {
  const result: SuggestionResult = {
    recordId: record.recordId,
    step1_validation: { valid: true },
    step3_grouping: { inaCbgCode: '', cmgCode: '', confidence: 0 },
    step7_suggestions: [],
    overallConfidence: 0,
  };

  // ========== STEP 1: Validation ==========
  const validationErrors: string[] = [];

  if (!record.diagnosisCodes || record.diagnosisCodes.length === 0) {
    validationErrors.push('Diagnosis codes tidak ada');
  }

  if (!record.serviceType) {
    validationErrors.push('Jenis pelayanan tidak ada');
  }

  result.step1_validation = {
    valid: validationErrors.length === 0,
    errors: validationErrors.length > 0 ? validationErrors : undefined,
  };

  if (!result.step1_validation.valid) {
    result.overallConfidence = 0;
    result.step7_suggestions.push({
      type: 'ERROR',
      category: 'Validation',
      title: 'Data Tidak Valid',
      description: validationErrors.join('; '),
      action: 'CONTACT_IT',
      priority: 'HIGH',
      affectsAmount: true,
    });
    return result;
  }

  // ========== STEP 2: Extract (already done in input) ==========

  // ========== STEP 3: INA-CBG Grouping (DETERMINISTIC) ==========
  result.step3_grouping = await groupRecordToInaChg(record);

  // ========== STEP 4: Tariff Lookup ==========
  const tariffData = await lookupTariff(result.step3_grouping.cmgCode);
  result.step4_tariff = {
    found: tariffData !== null,
    data: tariffData || undefined,
  };

  // ========== STEP 5: Calculation ==========
  if (tariffData) {
    const topUpAllowed = result.step3_grouping.klasD?.hasTopUp !== false;
    result.step5_calculation = calculateClaim({
      tariff: tariffData,
      kelas,
      topUpApplied: topUpAllowed,
    });
  }

  // ========== STEP 6: Special Rules ==========
  result.step6_specialRules = checkSpecialRules({
    groupingResult: result.step3_grouping,
    record,
    kelas,
  });

  // ========== STEP 7: Generate Suggestions ==========
  result.step7_suggestions = generateSuggestions(
    result.step3_grouping,
    result.step4_tariff,
    result.step6_specialRules
  );

  // ========== Overall Confidence ==========
  // Combine grouping confidence + tariff found + validation
  const scores = [
    result.step3_grouping.confidence,
    result.step4_tariff.found ? 1 : 0.5,
    result.step1_validation.valid ? 1 : 0,
  ];
  result.overallConfidence = scores.reduce((a, b) => a + b, 0) / scores.length;

  return result;
}
