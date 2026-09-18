/**
 * INA-CBG Grouping Service
 * Implements PMK 3/2023 grouping rules for determining INA-CBG codes
 * from diagnosis (ICD-10) + procedure (ICD-9) combinations.
 *
 * References:
 * - PMK 3/2023 Bagian I (hal. 31–59): Grouping Rules & CMG Tables
 * - PMK 3/2023 Bagian II (hal. 85–91): Special CMG Criteria
 */

export interface ClaimGroupingInput {
  diagnosisCodes: string[]; // ICD-10 codes
  procedureCodes: string[]; // ICD-9 codes
  serviceType: 'RAWAT_JALAN' | 'RAWAT_INAP'; // Jenis Pelayanan
  kelasRs?: 'A' | 'B' | 'C' | 'D'; // Kelas RS untuk top-up checks
  clinicalFindings?: {
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    severity?: 'mild' | 'moderate' | 'severe';
    complication?: string;
  };
}

export interface GroupingResult {
  inaCbgCode: string;
  cmgCode: string;
  severity?: 'I' | 'II' | 'III'; // Jenjang severity jika ada
  specialCmg?: {
    type: 'SP' | 'SR' | 'SI' | 'SD' | 'SUBAKUT' | 'KRONIS' | null;
    reason?: string;
  };
  klasD?: {
    hasTopUp: boolean;
    applicableToDClassOnly?: boolean;
    warning?: string;
  };
  confidence: number; // 0-1, tingkat kepercayaan matching
  debugInfo?: {
    matchedDiagnosis?: string;
    matchedProcedure?: string;
    matchedRule?: string;
  };
}

// ============================================================================
// DIAGNOSIS & PROCEDURE GROUPING TABLES
// Reference: PMK 3/2023 Bagian I (hal. 31–59)
// ============================================================================

interface GroupingRule {
  id: string;
  diagnosisPattern: RegExp | string[];
  procedurePattern?: RegExp | string[];
  serviceType: 'RAWAT_JALAN' | 'RAWAT_INAP' | 'BOTH';
  cmgCode: string; // e.g., 'J-3-13' (3-digit)
  severityMapping?: {
    pattern: RegExp;
    levels: 'I' | 'II' | 'III';
  };
  specialCmgCheck?: string; // Reference to specialCmgRules id
  description: string;
}

const GROUPING_RULES: GroupingRule[] = [
  // ==== J45: Asthma (Asma) ====
  {
    id: 'asthma_outpatient_procedure_9394',
    diagnosisPattern: /^J45/,
    procedurePattern: ['9394'], // Spirometry/pulmonary function test
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'J-3-13',
    description: 'Asthma with outpatient spirometry (Rawat Jalan + J45.x + 93.94)',
  },
  {
    id: 'asthma_outpatient_no_procedure',
    diagnosisPattern: /^J45/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'J-3-12',
    description: 'Asthma without procedure (Rawat Jalan + J45.x)',
  },
  {
    id: 'asthma_inpatient_uncomplicated',
    diagnosisPattern: /^J45[.(][0-9]{0,1}$/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_INAP',
    cmgCode: 'J-1-1',
    description: 'Uncomplicated asthma inpatient (Rawat Inap + J45.x tanpa komplikasi)',
  },
  {
    id: 'asthma_inpatient_severe',
    diagnosisPattern: /^J45[.(](9|90)/, // J45.90, J45.99, J45.9
    procedurePattern: undefined,
    serviceType: 'RAWAT_INAP',
    cmgCode: 'J-1-2',
    severityMapping: {
      pattern: /status.?asthmaticus|severe|severe.?asthma/i,
      levels: 'II',
    },
    description: 'Severe asthma inpatient (Rawat Inap + J45.9)',
  },

  // ==== K25-K28: Peptic Ulcer Disease (Tukak Peptik) ====
  {
    id: 'peptic_ulcer_k25_outpatient',
    diagnosisPattern: /^K25/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'K-4-17',
    description: 'Gastric ulcer outpatient (Rawat Jalan + K25.x)',
  },
  {
    id: 'peptic_ulcer_k26_outpatient',
    diagnosisPattern: /^K26/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'K-4-18',
    description: 'Duodenal ulcer outpatient (Rawat Jalan + K26.x)',
  },
  {
    id: 'peptic_ulcer_inpatient_uncomplicated',
    diagnosisPattern: /^K2[5-6][.(][0-4]/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_INAP',
    cmgCode: 'K-1-8',
    description: 'Uncomplicated peptic ulcer inpatient (K25/K26 tanpa perdarahan)',
  },
  {
    id: 'peptic_ulcer_inpatient_with_hemorrhage',
    diagnosisPattern: /^K2[5-6][.(][0-1]/,
    procedurePattern: ['433', '434'], // GI bleed endoscopy codes
    serviceType: 'RAWAT_INAP',
    cmgCode: 'K-1-9',
    description: 'Peptic ulcer with hemorrhage inpatient (K25/K26 + perdarahan aktif)',
  },

  // ==== E10-E14: Diabetes Mellitus (Diabetes) ====
  {
    id: 'diabetes_type1_outpatient',
    diagnosisPattern: /^E10/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'E-4-1',
    description: 'Type 1 diabetes outpatient (E10.x)',
  },
  {
    id: 'diabetes_type2_outpatient',
    diagnosisPattern: /^E11/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'E-4-3',
    description: 'Type 2 diabetes outpatient (E11.x)',
  },
  {
    id: 'diabetes_type2_with_complication_outpatient',
    diagnosisPattern: /^E11/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'E-4-4',
    description: 'Type 2 diabetes with complication outpatient',
  },

  // ==== I10-I15: Hypertension (Hipertensi) ====
  {
    id: 'hypertension_outpatient',
    diagnosisPattern: /^I1[0-5]/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'I-4-1',
    description: 'Essential hypertension outpatient (I10.x)',
  },
  {
    id: 'hypertension_inpatient_with_crisis',
    diagnosisPattern: /^I1[0-5][.(](9|3)/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_INAP',
    cmgCode: 'I-1-2',
    description: 'Hypertensive crisis inpatient (I10.x dengan krisis)',
  },

  // ============== FALLBACK RULES (untuk diagnosis umum) ==============
  {
    id: 'outpatient_default',
    diagnosisPattern: /^[A-Z]/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_JALAN',
    cmgCode: 'NON-CMG', // Default: non-CMG
    description: 'Default outpatient (fallback)',
  },
  {
    id: 'inpatient_default',
    diagnosisPattern: /^[A-Z]/,
    procedurePattern: undefined,
    serviceType: 'RAWAT_INAP',
    cmgCode: 'NON-CMG', // Default: non-CMG
    description: 'Default inpatient (fallback)',
  },
];

// ============================================================================
// SEVERITY MAPPING (Clinical findings → Severity level)
// Reference: PMK 3/2023 severity criteria
// ============================================================================

interface SeverityRule {
  condition: string;
  check: (findings: ClaimGroupingInput['clinicalFindings']) => boolean;
  level: 'I' | 'II' | 'III';
}

const SEVERITY_RULES: SeverityRule[] = [
  // Severe/Critical (Level III)
  {
    condition: 'HR > 120 or < 60, RR > 30',
    check: (findings) => {
      if (!findings) return false;
      const criticalHR = findings.heartRate !== undefined && (findings.heartRate > 120 || findings.heartRate < 60);
      const criticalRR = findings.respiratoryRate !== undefined && findings.respiratoryRate > 30;
      return criticalHR || criticalRR;
    },
    level: 'III',
  },
  {
    condition: 'Fever > 39°C',
    check: (findings) => findings?.temperature !== undefined && findings.temperature > 39,
    level: 'III',
  },
  {
    condition: 'Explicit severe finding',
    check: (findings) => findings?.severity === 'severe',
    level: 'III',
  },
  // Moderate (Level II)
  {
    condition: 'HR 100-120 or RR 25-30',
    check: (findings) => {
      if (!findings) return false;
      const moderateHR = findings.heartRate !== undefined && findings.heartRate >= 100 && findings.heartRate <= 120;
      const moderateRR = findings.respiratoryRate !== undefined && findings.respiratoryRate >= 25 && findings.respiratoryRate <= 30;
      return moderateHR || moderateRR;
    },
    level: 'II',
  },
  {
    condition: 'Fever 38-39°C',
    check: (findings) => findings?.temperature !== undefined && findings.temperature >= 38 && findings.temperature <= 39,
    level: 'II',
  },
  {
    condition: 'Explicit moderate finding',
    check: (findings) => findings?.severity === 'moderate',
    level: 'II',
  },
];

// ============================================================================
// SPECIAL CMG DETECTION RULES
// Reference: PMK 3/2023 Bagian II (hal. 85–91)
// ============================================================================

interface SpecialCmgRule {
  type: 'SP' | 'SR' | 'SI' | 'SD' | 'SUBAKUT' | 'KRONIS';
  description: string;
  diagnosisPatterns: RegExp[];
  procedurePatterns?: RegExp[];
  klasDRestriction?: boolean; // true = tidak berlaku untuk Kelas D
  reason: string;
}

const SPECIAL_CMG_RULES: SpecialCmgRule[] = [
  {
    type: 'SP',
    description: 'Prosedur Pembedahan',
    diagnosisPatterns: [],
    procedurePatterns: [
      /^(00-89)/, // Surgical procedures (ICD-9: 00-89 range)
    ],
    klasDRestriction: true,
    reason: 'Operasi (SP) - top-up tidak berlaku untuk Kelas D',
  },
  {
    type: 'SR',
    description: 'Radiologi/Imaging',
    diagnosisPatterns: [],
    procedurePatterns: [
      /^87|^88/, // Radiology (87.x, 88.x)
    ],
    klasDRestriction: false,
    reason: 'Radiologi (SR)',
  },
  {
    type: 'SI',
    description: 'Intervensi Non-Bedah',
    diagnosisPatterns: [],
    procedurePatterns: [
      /^91/, // Special procedures (91.x)
      /^(98|99)[.](1|2|3|4|5|6|7|8|9)/, // Therapeutic procedures
    ],
    klasDRestriction: false,
    reason: 'Intervensi Non-Bedah (SI)',
  },
  {
    type: 'SD',
    description: 'Dialisis',
    diagnosisPatterns: [/^N18[.(][4-5]/, /^N19/], // Chronic kidney disease stage 4-5, ESRD
    procedurePatterns: [/^39[.](9|95)/], // Hemodialysis
    klasDRestriction: true,
    reason: 'Dialisis (SD) - top-up tidak berlaku untuk Kelas D',
  },
  {
    type: 'SUBAKUT',
    description: 'Perawatan Subakut',
    diagnosisPatterns: [/^Z75[.](2|3|4|5)/], // Malingering, etc
    procedurePatterns: [],
    klasDRestriction: false,
    reason: 'Perawatan Subakut (Subakut)',
  },
  {
    type: 'KRONIS',
    description: 'Perawatan Kronis',
    diagnosisPatterns: [
      /^E11/, // Type 2 DM (chronic)
      /^I1[0-5]/, // Hypertension (chronic)
      /^N18[.(][1-5]/, // CKD (chronic)
      /^J44/, // COPD (chronic)
    ],
    procedurePatterns: [],
    klasDRestriction: false,
    reason: 'Kondisi Kronis (Kronis)',
  },
];

// ============================================================================
// KELAS D TOP-UP RESTRICTION TABLE
// ============================================================================

const KELAS_D_TOP_UP_RESTRICTIONS: { cmgCode: string; reason: string; especiallyRestricted?: boolean }[] = [
  {
    cmgCode: 'SP-001',
    reason: 'Pembedahan Umum',
    especiallyRestricted: true,
  },
  {
    cmgCode: 'SD-001',
    reason: 'Dialisis',
    especiallyRestricted: true,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine severity from clinical findings
 */
function determineSeverity(clinicalFindings?: ClaimGroupingInput['clinicalFindings']): 'I' | 'II' | 'III' | undefined {
  if (!clinicalFindings) return undefined;

  // Check from highest to lowest severity
  for (const rule of SEVERITY_RULES) {
    if (rule.check(clinicalFindings)) {
      return rule.level;
    }
  }

  // Default to mild (Level I)
  return 'I';
}

/**
 * Match diagnosis against pattern (RegExp or string array)
 */
function matchDiagnosis(code: string, pattern: RegExp | string[]): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(code);
  }
  return pattern.includes(code);
}

/**
 * Match procedure against pattern (RegExp or string array)
 */
function matchProcedure(code: string, pattern?: RegExp | string[]): boolean {
  if (!pattern) return true; // No procedure requirement
  if (pattern instanceof RegExp) {
    return pattern.test(code);
  }
  return pattern.includes(code);
}

/**
 * Check if diagnosis+procedure+serviceType matches a grouping rule
 */
function matchGroupingRule(
  input: ClaimGroupingInput,
  rule: GroupingRule
): { matched: boolean; diagnosisMatch: boolean; procedureMatch: boolean } {
  const diagnosisCodes = input.diagnosisCodes || [];
  const procedureCodes = input.procedureCodes || [];

  // Check service type
  if (rule.serviceType !== 'BOTH' && rule.serviceType !== input.serviceType) {
    return { matched: false, diagnosisMatch: false, procedureMatch: false };
  }

  // Check if any diagnosis code matches
  const diagnosisMatch = diagnosisCodes.some(code => matchDiagnosis(code, rule.diagnosisPattern));
  if (!diagnosisMatch) {
    return { matched: false, diagnosisMatch: false, procedureMatch: false };
  }

  // Check if any procedure code matches (if pattern exists)
  if (rule.procedurePattern) {
    const procedureMatch = procedureCodes.some(code => matchProcedure(code, rule.procedurePattern));
    return { matched: procedureMatch, diagnosisMatch, procedureMatch };
  }

  // No procedure pattern required
  return { matched: true, diagnosisMatch, procedureMatch: true };
}

/**
 * Detect Special CMG from diagnosis and procedure
 */
function detectSpecialCmg(input: ClaimGroupingInput): SpecialCmgRule | null {
  const diagnosisCodes = input.diagnosisCodes || [];
  const procedureCodes = input.procedureCodes || [];

  for (const rule of SPECIAL_CMG_RULES) {
    // Check diagnosis patterns
    const diagnosisMatch = rule.diagnosisPatterns.length === 0 ||
      diagnosisCodes.some(code => rule.diagnosisPatterns.some(p => p.test(code)));

    // Check procedure patterns
    const procedureMatch = !rule.procedurePatterns ||
      procedureCodes.some(code => rule.procedurePatterns!.some(p => p.test(code)));

    if (diagnosisMatch && procedureMatch) {
      return rule;
    }
  }

  return null;
}

/**
 * Check Kelas D top-up restrictions
 */
function checkKlasDRestrictions(
  cmgCode: string,
  kelasRs?: 'A' | 'B' | 'C' | 'D',
  specialCmg?: SpecialCmgRule
): { hasTopUp: boolean; warning?: string; applicableToDClassOnly?: boolean } {
  if (kelasRs !== 'D') {
    return { hasTopUp: true };
  }

  // Check if this CMG type is restricted for Kelas D
  if (specialCmg?.klasDRestriction) {
    return {
      hasTopUp: false,
      warning: `CMG ${specialCmg.type} tidak berlaku top-up untuk Kelas D: ${specialCmg.reason}`,
      applicableToDClassOnly: false,
    };
  }

  // Check specific CMG code restrictions
  const restriction = KELAS_D_TOP_UP_RESTRICTIONS.find(r => r.cmgCode === cmgCode);
  if (restriction) {
    return {
      hasTopUp: false,
      warning: `Top-up tidak berlaku untuk Kelas D: ${restriction.reason}`,
      applicableToDClassOnly: false,
    };
  }

  return { hasTopUp: true };
}

// ============================================================================
// MAIN GROUPING FUNCTION
// ============================================================================

export async function groupClaimToCmg(input: ClaimGroupingInput): Promise<GroupingResult> {
  // Validate inputs
  if (!input.diagnosisCodes || input.diagnosisCodes.length === 0) {
    return {
      inaCbgCode: 'UNKNOWN',
      cmgCode: 'UNKNOWN',
      confidence: 0,
      debugInfo: { matchedRule: 'No diagnosis codes provided' },
    };
  }

  // Try to find matching grouping rule
  let bestMatch: GroupingRule | null = null;
  let bestMatchScore = 0;

  for (const rule of GROUPING_RULES) {
    const { matched, diagnosisMatch, procedureMatch } = matchGroupingRule(input, rule);

    if (matched) {
      // Calculate confidence score (procedures increase confidence)
      let confidence = 0.7; // Base for diagnosis match
      if (procedureMatch && input.procedureCodes && input.procedureCodes.length > 0) {
        confidence = 0.95;
      }

      if (confidence > bestMatchScore) {
        bestMatch = rule;
        bestMatchScore = confidence;
      }
    }
  }

  // If no rule matched, use default
  if (!bestMatch) {
    return {
      inaCbgCode: 'NON-CMG',
      cmgCode: 'NON-CMG',
      confidence: 0.3,
      debugInfo: { matchedRule: 'No matching rule found, using default' },
    };
  }

  // Extract diagnosis code for debug info
  const matchedDiagnosis = input.diagnosisCodes.find(code => matchDiagnosis(code, bestMatch!.diagnosisPattern));

  // Determine severity
  const severity = determineSeverity(input.clinicalFindings) ||
    (bestMatch.severityMapping ? 'I' : undefined);

  // Detect Special CMG
  const specialCmg = detectSpecialCmg(input);

  // Check Kelas D restrictions
  const klasDCheck = checkKlasDRestrictions(bestMatch.cmgCode, input.kelasRs, specialCmg || undefined);

  // Build final CMG code (with severity suffix if applicable)
  let finalCmgCode = bestMatch.cmgCode;
  if (severity && ['I', 'II', 'III'].includes(severity)) {
    // Only add severity suffix if rule supports it
    if (bestMatch.severityMapping || severity !== 'I') {
      finalCmgCode = `${bestMatch.cmgCode}-${severity}`;
    }
  }

  return {
    inaCbgCode: finalCmgCode,
    cmgCode: bestMatch.cmgCode,
    severity: severity as 'I' | 'II' | 'III' | undefined,
    specialCmg: specialCmg ? {
      type: specialCmg.type,
      reason: specialCmg.reason,
    } : undefined,
    klasD: klasDCheck,
    confidence: bestMatchScore,
    debugInfo: {
      matchedDiagnosis,
      matchedRule: bestMatch.id,
    },
  };
}

/**
 * Validate INA-CBG code format
 * Standard format: X-D-NN or X-D-NN-L
 * where X = letter (J, K, E, I, etc), D = digit, NN = 2-digit number, L = severity level (I/II/III)
 */
export function validateCbgCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'CBG code must be a non-empty string' };
  }

  // Check format: X-D-NN[-SEVERITY]
  const pattern = /^[A-Z]-\d-\d{2}(-[IVX]{1,3})?$/;
  if (!pattern.test(code)) {
    return {
      valid: false,
      error: `Invalid CBG code format: ${code}. Expected X-D-NN or X-D-NN-SEVERITY`,
    };
  }

  return { valid: true };
}

/**
 * Extract CMG prefix (e.g., 'K-4-17-I' → 'K-4-17')
 */
export function extractCmgPrefix(cbgCode: string): string {
  return cbgCode.split('-').slice(0, 3).join('-');
}

/**
 * Compare with previous/known CMG for verification
 */
export function compareCbgCodes(
  current: string,
  previous: string
): {
  same: boolean;
  severity_changed?: 'upgraded' | 'downgraded' | 'changed';
  cmg_changed?: boolean;
} {
  const currentPrefix = extractCmgPrefix(current);
  const previousPrefix = extractCmgPrefix(previous);

  const cmgChanged = currentPrefix !== previousPrefix;

  if (cmgChanged) {
    return { same: false, cmg_changed: true };
  }

  // Check if only severity changed
  const currentSeverity = current.split('-')[3];
  const previousSeverity = previous.split('-')[3];

  if (currentSeverity !== previousSeverity) {
    const severityOrder = { 'I': 1, 'II': 2, 'III': 3 };
    const currentLevel = severityOrder[currentSeverity as keyof typeof severityOrder] || 0;
    const previousLevel = severityOrder[previousSeverity as keyof typeof severityOrder] || 0;

    return {
      same: false,
      severity_changed: currentLevel > previousLevel ? 'upgraded' : 'downgraded',
    };
  }

  return { same: true };
}
