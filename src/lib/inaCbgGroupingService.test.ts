/**
 * Test cases for INA-CBG Grouping Service
 * Tests cover:
 * 1. Firdan: J45.9 + 93.94 → J-3-13-0 (Asthma with spirometry)
 * 2. ELVINA: K-4-17-I (Gastric ulcer with severity I)
 * 3. Kelas D restrictions (top-up tidak berlaku)
 * 4. Special CMG detection
 * 5. Severity mapping from clinical findings
 */

import {
compareCbgCodes,
extractCmgPrefix,
groupClaimToCmg,
validateCbgCode,
type ClaimGroupingInput
} from './inaCbgGroupingService';

// ============================================================================
// TEST CASES
// ============================================================================

describe('INA-CBG Grouping Service', () => {
  // ========== TEST 1: Firdan - Asthma Outpatient with Spirometry ==========
  describe('Test 1: Firdan - Asthma (J45.9) + Spirometry (93.94)', () => {
    it('should group Rawat Jalan + J45.9 + 93.94 to J-3-13', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['J45.9'],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          heartRate: 88,
          respiratoryRate: 22,
        },
      };

      const result = await groupClaimToCmg(input);

      expect(result.inaCbgCode).toBe('J-3-13');
      expect(result.cmgCode).toBe('J-3-13');
      expect(result.confidence).toBeGreaterThan(0.9); // Should be high confidence
      expect(result.debugInfo?.matchedDiagnosis).toBe('J45.9');
      expect(result.debugInfo?.matchedRule).toBe('asthma_outpatient_procedure_9394');
    });

    it('should handle variant ICD codes (J45, J45.0, J45.901, etc)', async () => {
      const variants = ['J45', 'J45.0', 'J45.901', 'J45.99'];

      for (const code of variants) {
        const input: ClaimGroupingInput = {
          diagnosisCodes: [code],
          procedureCodes: ['9394'],
          serviceType: 'RAWAT_JALAN',
        };

        const result = await groupClaimToCmg(input);
        expect(result.cmgCode).toBe('J-3-13');
      }
    });

    it('should use fallback rule if procedure missing', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['J45.9'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      expect(result.cmgCode).toBe('J-3-12'); // Fallback: no procedure
      expect(result.confidence).toBeLessThan(0.95);
    });
  });

  // ========== TEST 2: ELVINA - Gastric Ulcer with Severity ==========
  describe('Test 2: ELVINA - Gastric Ulcer (K25.x) → K-4-17-I', () => {
    it('should group K25 (gastric ulcer) to K-4-17 outpatient', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['K25.9'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          severity: 'mild',
          heartRate: 72,
        },
      };

      const result = await groupClaimToCmg(input);
      expect(result.cmgCode).toBe('K-4-17');
      expect(result.inaCbgCode).toMatch(/^K-4-17/);
    });

    it('should add severity suffix based on clinical findings', async () => {
      // Mild findings → Level I
      const mildInput: ClaimGroupingInput = {
        diagnosisCodes: ['K25.5'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          severity: 'mild',
          heartRate: 70,
          respiratoryRate: 16,
          temperature: 36.5,
        },
      };

      const mildResult = await groupClaimToCmg(mildInput);
      expect(mildResult.severity).toBe('I');

      // Moderate findings → Level II
      const moderateInput: ClaimGroupingInput = {
        diagnosisCodes: ['K25.5'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          severity: 'moderate',
          heartRate: 105,
          respiratoryRate: 26,
          temperature: 38.5,
        },
      };

      const moderateResult = await groupClaimToCmg(moderateInput);
      expect(moderateResult.severity).toBe('II');

      // Severe findings → Level III
      const severeInput: ClaimGroupingInput = {
        diagnosisCodes: ['K25.5'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          severity: 'severe',
          heartRate: 130,
          respiratoryRate: 35,
          temperature: 39.5,
        },
      };

      const severeResult = await groupClaimToCmg(severeInput);
      expect(severeResult.severity).toBe('III');
    });

    it('should detect peptic ulcer with hemorrhage as more severe', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['K25.0'], // Acute with hemorrhage
        procedureCodes: ['4330'], // Endoscopy with control of hemorrhage
        serviceType: 'RAWAT_INAP',
        clinicalFindings: {
          heartRate: 125,
          bloodPressureSystolic: 95,
        },
      };

      const result = await groupClaimToCmg(input);
      // Should map to K-1-9 (peptic ulcer with hemorrhage)
      expect(result.debugInfo?.matchedRule).toContain('hemorrhage');
    });
  });

  // ========== TEST 3: Kelas D Top-up Restrictions ==========
  describe('Test 3: Kelas D Restrictions - Special CMG top-up tidak berlaku', () => {
    it('should warn when dialysis (SD) assigned to Kelas D', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['N19'], // End-stage renal disease
        procedureCodes: ['3995'], // Hemodialysis
        serviceType: 'RAWAT_INAP',
        kelasRs: 'D',
      };

      const result = await groupClaimToCmg(input);
      expect(result.klasD).toBeDefined();
      expect(result.klasD?.hasTopUp).toBe(false);
      expect(result.klasD?.warning).toContain('Kelas D');
      expect(result.specialCmg?.type).toBe('SD');
    });

    it('should not warn for non-restricted CMG in Kelas D', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['I10.9'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        kelasRs: 'D',
      };

      const result = await groupClaimToCmg(input);
      expect(result.klasD?.hasTopUp).toBe(true);
    });

    it('should allow top-up for non-Kelas-D', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['N19'],
        procedureCodes: ['3995'],
        serviceType: 'RAWAT_INAP',
        kelasRs: 'A',
      };

      const result = await groupClaimToCmg(input);
      expect(result.klasD?.hasTopUp).toBe(true);
    });
  });

  // ========== TEST 4: Special CMG Detection ==========
  describe('Test 4: Special CMG Detection', () => {
    it('should detect Radiologi (SR) CMG', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['R50.9'], // Fever
        procedureCodes: ['8720'], // X-ray
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      expect(result.specialCmg?.type).toBe('SR');
    });

    it('should detect Intervensi Non-Bedah (SI) CMG', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['I10.9'],
        procedureCodes: ['9191'], // Special procedure
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      expect(result.specialCmg?.type).toBe('SI');
    });

    it('should detect KRONIS (chronic) conditions', async () => {
      const chronicConditions = [
        'E11.9', // Type 2 diabetes
        'I10.9', // Hypertension
        'N18.3', // CKD stage 3
        'J44.9', // COPD
      ];

      for (const diagnosis of chronicConditions) {
        const input: ClaimGroupingInput = {
          diagnosisCodes: [diagnosis],
          procedureCodes: [],
          serviceType: 'RAWAT_JALAN',
        };

        const result = await groupClaimToCmg(input);
        expect(result.specialCmg?.type).toBe('KRONIS');
      }
    });
  });

  // ========== TEST 5: Severity Mapping from Clinical Findings ==========
  describe('Test 5: Severity Mapping from Clinical Findings', () => {
    it('should determine Level III (severe) from vital signs', async () => {
      const severeVitals: ClaimGroupingInput = {
        diagnosisCodes: ['J45.902'],
        procedureCodes: [],
        serviceType: 'RAWAT_INAP',
        clinicalFindings: {
          heartRate: 135, // > 120
          respiratoryRate: 35, // > 30
          temperature: 39.5, // > 39
        },
      };

      const result = await groupClaimToCmg(severeVitals);
      expect(result.severity).toBe('III');
    });

    it('should determine Level II (moderate) from vital signs', async () => {
      const moderateVitals: ClaimGroupingInput = {
        diagnosisCodes: ['J45.902'],
        procedureCodes: [],
        serviceType: 'RAWAT_INAP',
        clinicalFindings: {
          heartRate: 110,
          respiratoryRate: 28,
          temperature: 38.7,
        },
      };

      const result = await groupClaimToCmg(moderateVitals);
      expect(result.severity).toBe('II');
    });

    it('should default to Level I (mild) for normal vitals', async () => {
      const normalVitals: ClaimGroupingInput = {
        diagnosisCodes: ['J45.900'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: {
          heartRate: 80,
          respiratoryRate: 18,
          temperature: 36.8,
        },
      };

      const result = await groupClaimToCmg(normalVitals);
      expect(result.severity).toBe('I');
    });
  });

  // ========== TEST 6: CBG Code Validation & Manipulation ==========
  describe('Test 6: CBG Code Validation & Manipulation', () => {
    it('should validate correct CBG code formats', () => {
      const validCodes = [
        'J-3-13',
        'K-4-17',
        'K-4-17-I',
        'J-1-2-III',
        'E-4-1-II',
      ];

      validCodes.forEach(code => {
        const result = validateCbgCode(code);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid CBG code formats', () => {
      const invalidCodes = [
        'J45.9', // Wrong format (diagnosis code, not CBG)
        'J-3', // Missing digit
        'J-3-1', // Needs 2 digits
        'J3-13', // Missing hyphens
        '3-13-J', // Wrong order
      ];

      invalidCodes.forEach(code => {
        const result = validateCbgCode(code);
        expect(result.valid).toBe(false);
      });
    });

    it('should extract CMG prefix correctly', () => {
      expect(extractCmgPrefix('K-4-17-I')).toBe('K-4-17');
      expect(extractCmgPrefix('J-3-13-III')).toBe('J-3-13');
      expect(extractCmgPrefix('E-4-1')).toBe('E-4-1');
    });

    it('should compare CBG codes correctly', () => {
      // Same CMG, different severity
      const result1 = compareCbgCodes('K-4-17-II', 'K-4-17-I');
      expect(result1.same).toBe(false);
      expect(result1.severity_changed).toBe('upgraded');

      // Different CMG
      const result2 = compareCbgCodes('J-3-13', 'K-4-17');
      expect(result2.same).toBe(false);
      expect(result2.cmg_changed).toBe(true);

      // Identical
      const result3 = compareCbgCodes('K-4-17-I', 'K-4-17-I');
      expect(result3.same).toBe(true);
    });
  });

  // ========== TEST 7: Edge Cases & Error Handling ==========
  describe('Test 7: Edge Cases & Error Handling', () => {
    it('should handle empty diagnosis codes gracefully', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: [],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      expect(result.cmgCode).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('should handle missing clinical findings gracefully', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['J45.9'],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: undefined,
      };

      const result = await groupClaimToCmg(input);
      expect(result.cmgCode).toBe('J-3-13');
      expect(result.severity).toBeUndefined();
    });

    it('should handle multiple diagnosis codes (first match wins)', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['Z99.8', 'J45.9', 'I10.9'],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      // Should match J45.9 with procedure
      expect(result.cmgCode).toBe('J-3-13');
    });

    it('should fall back to default rule if no specific rule matches', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['Z99.9'], // Generic code
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);
      expect(result.cmgCode).toBe('NON-CMG');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  // ========== TEST 8: Integration with Suggestion Workflow ==========
  describe('Test 8: Integration with Suggestion Workflow', () => {
    it('should provide deterministic grouping (step 3 of workflow)', async () => {
      // Same input should always produce same output
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['J45.9'],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: { heartRate: 88, respiratoryRate: 22 },
      };

      const result1 = await groupClaimToCmg(input);
      const result2 = await groupClaimToCmg(input);

      expect(result1.inaCbgCode).toBe(result2.inaCbgCode);
      expect(result1.severity).toBe(result2.severity);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should separate from tariff lookup (step 4 of workflow)', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['K25.9'],
        procedureCodes: [],
        serviceType: 'RAWAT_JALAN',
      };

      const result = await groupClaimToCmg(input);

      // Grouping should produce CBG code only, not tariff
      expect(result.inaCbgCode).toBeDefined();
      expect(result.cmgCode).toBeDefined();
      // Tariff lookup should be separate call to tariff service
      // result does NOT contain tariff_amount, claim_amount, etc
      expect(result.inaCbgCode).not.toMatch(/\d{4,}/); // No large numbers (prices)
    });

    it('should provide sufficient info for manual review', async () => {
      const input: ClaimGroupingInput = {
        diagnosisCodes: ['J45.9'],
        procedureCodes: ['9394'],
        serviceType: 'RAWAT_JALAN',
        clinicalFindings: { heartRate: 88 },
      };

      const result = await groupClaimToCmg(input);

      // Should include debugging info for verification
      expect(result.debugInfo).toBeDefined();
      expect(result.debugInfo?.matchedDiagnosis).toBe('J45.9');
      expect(result.debugInfo?.matchedRule).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// MANUAL TEST RUNNERS (for development/debugging)
// ============================================================================

export async function runTestScenarios(): Promise<void> {
  console.log('=== INA-CBG Grouping Service Test Scenarios ===\n');

  // Scenario 1: Firdan
  console.log('Scenario 1: Firdan - Asthma with Spirometry');
  const firdanResult = await groupClaimToCmg({
    diagnosisCodes: ['J45.9'],
    procedureCodes: ['9394'],
    serviceType: 'RAWAT_JALAN',
    clinicalFindings: { heartRate: 88, respiratoryRate: 22 },
  });
  console.log('Result:', firdanResult);
  console.log('Expected: J-3-13 with high confidence\n');

  // Scenario 2: ELVINA
  console.log('Scenario 2: ELVINA - Gastric Ulcer');
  const elvinaResult = await groupClaimToCmg({
    diagnosisCodes: ['K25.5'],
    procedureCodes: [],
    serviceType: 'RAWAT_JALAN',
    clinicalFindings: { heartRate: 72, severity: 'mild' },
  });
  console.log('Result:', elvinaResult);
  console.log('Expected: K-4-17-I (gastric ulcer with mild severity)\n');

  // Scenario 3: Kelas D Dialysis
  console.log('Scenario 3: Kelas D Restriction - Dialysis');
  const klasDResult = await groupClaimToCmg({
    diagnosisCodes: ['N19'],
    procedureCodes: ['3995'],
    serviceType: 'RAWAT_INAP',
    kelasRs: 'D',
  });
  console.log('Result:', klasDResult);
  console.log('Expected: SD with warning about Kelas D top-up restriction\n');
}
