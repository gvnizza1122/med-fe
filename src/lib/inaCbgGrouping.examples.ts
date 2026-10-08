/**
 * INA-CBG Grouping Service - Usage Examples
 * Practical examples for common scenarios in claim verification.
 */

import {
  groupClaimToCmg,
  validateCbgCode,
  extractCmgPrefix,
  compareCbgCodes,
  type ClaimGroupingInput,
} from './inaCbgGroupingService';

import {
  runClaimSuggestionWorkflow,
  type ExtractedRecord,
} from './claimSuggestionWorkflow';

// ============================================================================
// Example 1: Firdan - Asthma Outpatient with Spirometry
// ============================================================================

export async function example_firdan_asthma() {
  console.log('\n=== Example 1: Firdan - Asthma with Spirometry ===\n');

  const input: ClaimGroupingInput = {
    diagnosisCodes: ['J45.9'],           // Asthma unspecified
    procedureCodes: ['9394'],            // Spirometry/pulmonary function test
    serviceType: 'RAWAT_JALAN',          // Outpatient
    clinicalFindings: {
      heartRate: 88,
      respiratoryRate: 22,
      temperature: 36.8,
    },
  };

  const result = await groupClaimToCmg(input);

  console.log('Input:');
  console.log(`  Diagnosis: ${input.diagnosisCodes.join(', ')}`);
  console.log(`  Procedure: ${input.procedureCodes.join(', ')}`);
  console.log(`  Service: ${input.serviceType}`);

  console.log('\nOutput:');
  console.log(`  INA-CBG Code: ${result.inaCbgCode}`);
  console.log(`  CMG: ${result.cmgCode}`);
  console.log(`  Severity: ${result.severity || 'N/A'}`);
  console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`  Matched Rule: ${result.debugInfo?.matchedRule}`);

  // Expected output:
  // INA-CBG Code: J-3-13
  // CMG: J-3-13
  // Severity: I (from normal vitals)
  // Confidence: 95.0% (procedure match)
}

// ============================================================================
// Example 2: ELVINA - Gastric Ulcer with Severity Levels
// ============================================================================

export async function example_elvina_peptic_ulcer() {
  console.log('\n=== Example 2: ELVINA - Gastric Ulcer ===\n');

  // Scenario 2a: Mild severity
  console.log('Scenario 2a: Mild presentation');
  const mildInput: ClaimGroupingInput = {
    diagnosisCodes: ['K25.5'],           // Gastric ulcer
    procedureCodes: [],
    serviceType: 'RAWAT_JALAN',
    clinicalFindings: {
      severity: 'mild',
      heartRate: 72,
      respiratoryRate: 16,
      temperature: 36.5,
    },
  };

  const mildResult = await groupClaimToCmg(mildInput);
  console.log(`  CMG: ${mildResult.cmgCode}`);
  console.log(`  Full Code: ${mildResult.inaCbgCode}`);
  console.log(`  Severity: ${mildResult.severity}`);
  // Expected: K-4-17-I

  // Scenario 2b: Moderate severity
  console.log('\nScenario 2b: Moderate presentation');
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
  console.log(`  CMG: ${moderateResult.cmgCode}`);
  console.log(`  Full Code: ${moderateResult.inaCbgCode}`);
  console.log(`  Severity: ${moderateResult.severity}`);
  // Expected: K-4-17-II

  // Scenario 2c: With hemorrhage (inpatient)
  console.log('\nScenario 2c: With hemorrhage (inpatient)');
  const hemorrhageInput: ClaimGroupingInput = {
    diagnosisCodes: ['K25.0'],           // Acute with hemorrhage
    procedureCodes: ['4330'],            // Endoscopy with control
    serviceType: 'RAWAT_INAP',
    clinicalFindings: {
      severity: 'severe',
      heartRate: 130,
      respiratoryRate: 32,
      temperature: 37.2,
    },
  };

  const hemorrhageResult = await groupClaimToCmg(hemorrhageInput);
  console.log(`  CMG: ${hemorrhageResult.cmgCode}`);
  console.log(`  Full Code: ${hemorrhageResult.inaCbgCode}`);
  console.log(`  Severity: ${hemorrhageResult.severity}`);
  // Expected: K-1-9-III (peptic ulcer with hemorrhage, severe)
}

// ============================================================================
// Example 3: Kelas D Restrictions - Dialysis
// ============================================================================

export async function example_klasd_dialysis_restriction() {
  console.log('\n=== Example 3: Kelas D Dialysis Restriction ===\n');

  // Scenario 3a: Dialysis in Kelas A (allowed)
  console.log('Scenario 3a: Dialysis in Kelas A');
  const kelasAInput: ClaimGroupingInput = {
    diagnosisCodes: ['N19'],             // ESRD
    procedureCodes: ['3995'],            // Hemodialysis
    serviceType: 'RAWAT_INAP',
    kelasRs: 'A',
  };

  const kelasAResult = await groupClaimToCmg(kelasAInput);
  console.log(`  Special CMG: ${kelasAResult.specialCmg?.type}`);
  console.log(`  Top-up Allowed: ${kelasAResult.klasD?.hasTopUp}`);
  console.log(`  Message: ${kelasAResult.klasD?.warning || 'No restriction'}`);
  // Expected: Top-up allowed for Kelas A

  // Scenario 3b: Dialysis in Kelas D (restricted)
  console.log('\nScenario 3b: Dialysis in Kelas D');
  const klasDInput: ClaimGroupingInput = {
    diagnosisCodes: ['N19'],
    procedureCodes: ['3995'],
    serviceType: 'RAWAT_INAP',
    kelasRs: 'D',
  };

  const klasDResult = await groupClaimToCmg(klasDInput);
  console.log(`  Special CMG: ${klasDResult.specialCmg?.type}`);
  console.log(`  Top-up Allowed: ${klasDResult.klasD?.hasTopUp}`);
  console.log(`  Warning: ${klasDResult.klasD?.warning}`);
  // Expected: Top-up NOT allowed, warning shown
}

// ============================================================================
// Example 4: Special CMG Detection
// ============================================================================

export async function example_special_cmg_detection() {
  console.log('\n=== Example 4: Special CMG Types ===\n');

  const scenarios = [
    {
      name: 'Surgery (SP)',
      diagnosis: ['K81.9'],     // Cholecystitis
      procedure: ['5123'],      // Cholecystectomy
      expectedType: 'SP',
    },
    {
      name: 'Radiology (SR)',
      diagnosis: ['R50.9'],     // Fever
      procedure: ['8720'],      // X-ray
      expectedType: 'SR',
    },
    {
      name: 'Intervention (SI)',
      diagnosis: ['I10.9'],     // Hypertension
      procedure: ['9191'],      // Special procedure
      expectedType: 'SI',
    },
    {
      name: 'Chronic (KRONIS)',
      diagnosis: ['E11.9'],     // Type 2 DM
      procedure: [],
      expectedType: 'KRONIS',
    },
  ];

  for (const scenario of scenarios) {
    const input: ClaimGroupingInput = {
      diagnosisCodes: scenario.diagnosis,
      procedureCodes: scenario.procedure,
      serviceType: 'RAWAT_JALAN',
    };

    const result = await groupClaimToCmg(input);
    console.log(`${scenario.name}:`);
    console.log(`  Diagnosis: ${scenario.diagnosis.join(', ')}`);
    console.log(`  Procedure: ${scenario.procedure.join(', ') || 'None'}`);
    console.log(`  Special CMG: ${result.specialCmg?.type || 'None'}`);
    console.log(`  CMG Code: ${result.cmgCode}`);
    console.log('');
  }
}

// ============================================================================
// Example 5: Severity Escalation
// ============================================================================

export async function example_severity_escalation() {
  console.log('\n=== Example 5: Severity Escalation from Vitals ===\n');

  const diagnosis = 'J45.9';  // Asthma
  const vitalsScenarios = [
    {
      name: 'Normal vitals',
      findings: { heartRate: 80, respiratoryRate: 18, temperature: 36.8 },
      expectedSeverity: 'I',
    },
    {
      name: 'Tachycardia + fever',
      findings: { heartRate: 110, respiratoryRate: 26, temperature: 38.7 },
      expectedSeverity: 'II',
    },
    {
      name: 'Critical vitals',
      findings: { heartRate: 135, respiratoryRate: 35, temperature: 39.5 },
      expectedSeverity: 'III',
    },
  ];

  for (const scenario of vitalsScenarios) {
    const input: ClaimGroupingInput = {
      diagnosisCodes: [diagnosis],
      procedureCodes: [],
      serviceType: 'RAWAT_INAP',
      clinicalFindings: scenario.findings as NonNullable<ClaimGroupingInput['clinicalFindings']>,
    };

    const result = await groupClaimToCmg(input);
    console.log(`${scenario.name}:`);
    console.log(`  HR: ${scenario.findings.heartRate}, RR: ${scenario.findings.respiratoryRate}, Temp: ${scenario.findings.temperature}`);
    console.log(`  Determined Severity: ${result.severity}`);
    console.log(`  CMG Code: ${result.inaCbgCode}`);
    console.log('');
  }
}

// ============================================================================
// Example 6: CBG Code Validation & Comparison
// ============================================================================

export function example_cbg_code_operations() {
  console.log('\n=== Example 6: CBG Code Operations ===\n');

  // Validation
  console.log('Validation Examples:');
  const codesToValidate = ['K-4-17', 'K-4-17-I', 'J45.9', 'invalid'];
  for (const code of codesToValidate) {
    const validation = validateCbgCode(code);
    console.log(`  ${code}: ${validation.valid ? '✓ Valid' : `✗ Invalid - ${validation.error}`}`);
  }

  // Extract prefix
  console.log('\nCMG Prefix Extraction:');
  const codes = ['K-4-17-I', 'J-3-13-III', 'E-4-1'];
  for (const code of codes) {
    console.log(`  ${code} → ${extractCmgPrefix(code)}`);
  }

  // Compare codes
  console.log('\nCBG Code Comparison:');
  const comparisons = [
    { current: 'K-4-17-I', previous: 'K-4-17-I', expected: 'Same' },
    { current: 'K-4-17-II', previous: 'K-4-17-I', expected: 'Upgraded' },
    { current: 'K-4-17-I', previous: 'K-4-17-II', expected: 'Downgraded' },
    { current: 'J-3-13', previous: 'K-4-17', expected: 'Different CMG' },
  ];

  for (const comparison of comparisons) {
    const result = compareCbgCodes(comparison.current, comparison.previous);
    const status = result.same
      ? 'Same'
      : result.severity_changed
      ? `Severity ${result.severity_changed}`
      : result.cmg_changed
      ? 'Different CMG'
      : 'Different';
    console.log(`  ${comparison.previous} → ${comparison.current}: ${status} (${comparison.expected})`);
  }
}

// ============================================================================
// Example 7: Complete Workflow
// ============================================================================

export async function example_complete_workflow() {
  console.log('\n=== Example 7: Complete Claim Verification Workflow ===\n');

  // Raw extracted data from PDF
  const record: ExtractedRecord = {
    recordId: 'REC-2026-09-001',
    patientName: 'Budi Santoso',
    medicalRecordNumber: 'MR-123456',
    admissionDate: '2026-09-15',
    dischargeDate: '2026-09-17',
    serviceType: 'RAWAT_INAP',
    diagnosisCodes: ['E11.9', 'I10.9'],    // Type 2 DM, Hypertension
    procedureCodes: [],
    clinicalFindings: {
      heartRate: 85,
      respiratoryRate: 20,
      temperature: 36.9,
      severity: 'mild',
    },
  };

  // Run complete workflow
  console.log('Input Record:');
  console.log(`  Patient: ${record.patientName}`);
  console.log(`  MR: ${record.medicalRecordNumber}`);
  console.log(`  Diagnoses: ${record.diagnosisCodes.join(', ')}`);
  console.log(`  Service: ${record.serviceType}`);

  const workflowResult = await runClaimSuggestionWorkflow(record, 'B');

  console.log('\nWorkflow Result:');
  console.log(`  Step 1 - Validation: ${workflowResult.step1_validation.valid ? '✓ Pass' : '✗ Fail'}`);
  console.log(`  Step 3 - Grouping: ${workflowResult.step3_grouping.cmgCode}`);
  console.log(`  Step 4 - Tariff: ${workflowResult.step4_tariff?.found ? '✓ Found' : '✗ Not found'}`);

  if (workflowResult.step5_calculation) {
    console.log(`  Step 5 - Calculation:`);
    console.log(`    Base: ${workflowResult.step5_calculation.baseClaim.toLocaleString('id-ID')} IDR`);
    console.log(`    Top-up: ${(workflowResult.step5_calculation.topUp ?? 0).toLocaleString('id-ID')} IDR`);
    console.log(`    Total: ${workflowResult.step5_calculation.totalClaim.toLocaleString('id-ID')} IDR`);
  }

  console.log(`  Step 7 - Suggestions: ${workflowResult.step7_suggestions.length}`);
  workflowResult.step7_suggestions.forEach((s, i) => {
    console.log(`    ${i + 1}. [${s.type}] ${s.title}`);
  });

  console.log(`\n  Overall Confidence: ${(workflowResult.overallConfidence * 100).toFixed(1)}%`);
}

// ============================================================================
// Run all examples
// ============================================================================

export async function runAllExamples() {
  try {
    await example_firdan_asthma();
    await example_elvina_peptic_ulcer();
    await example_klasd_dialysis_restriction();
    await example_special_cmg_detection();
    await example_severity_escalation();
    example_cbg_code_operations();
    await example_complete_workflow();

    console.log('\n=== All examples completed successfully ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export individual examples for testing
export const examples = {
  firdan: example_firdan_asthma,
  elvina: example_elvina_peptic_ulcer,
  klasd: example_klasd_dialysis_restriction,
  specialCmg: example_special_cmg_detection,
  severity: example_severity_escalation,
  cbgOperations: example_cbg_code_operations,
  workflow: example_complete_workflow,
  runAll: runAllExamples,
};
