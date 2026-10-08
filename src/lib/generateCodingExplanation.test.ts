/**
 * Test Cases untuk generateCodingExplanation
 *
 * Usage Examples:
 * 1. Firdan Case (Asthma dengan bukti klinis)
 * 2. Hypertension Case (Tekanan darah tinggi)
 * 3. Multiple codes dengan bukti parsial
 */

import {
generateCodingExplanation,
type CodingExplanationResult
} from './generateCodingExplanation';

// ─── Test Case 1: Firdan (Asthma J45.9) ─────────────────────────────────────

/**
 * Diagnosis: J45.9 (Asthma, unspecified)
 * Bukti Klinis: Sesak napas, ronchi bilateral
 * Expected Output:
 * • Asthma, unspecified (WHO ICD-10 2010)
 * • Penyakit sesak nafas jangka panjang tanpa penyebab spesifik
 * • Temuan: Auskultasi paru menunjukkan obstruksi saluran napas
 * • Tercatat di Resume Medis hal. 2
 * • Status: Valid
 */
export function testFirdanCase(): CodingExplanationResult {
  const clinicalFindings = {
    diagnosis: 'Asthma bronchiale dengan status asthmaticus',
    vital_signs: 'RR: 28 x/min, SpO2: 92%, ronchi bilateral',
    examination: 'Auskultasi paru: ronchi bilateral'
  };

  const result = generateCodingExplanation(
    'J45.9',
    'diagnosis',
    'valid',
    clinicalFindings,
    'Resume Medis hal. 2'
  );

  console.log('=== Test Case: Firdan (J45.9) ===');
  console.log('Input: J45.9 dengan bukti ronchi bilateral');
  console.log('Result:', {
    codes: result.codes.length,
    summary: result.summary,
    isComplete: result.isComplete
  });

  if (result.codes.length > 0) {
    const code = result.codes[0];
    console.log('\nExplanation Bullets:');
    code.explanationBullets.forEach(bullet => {
      console.log(`  • ${bullet}`);
    });
  }

  return result;
}

// ─── Test Case 2: Hypertension (I10) ─────────────────────────────────────────

/**
 * Diagnosis: I10 (Essential hypertension)
 * Bukti Klinis: TD sistolik 160 mmHg, diastolik 100 mmHg
 * Expected: Kode dengan penjelasan tekanan darah tinggi
 */
export function testHypertensionCase(): CodingExplanationResult {
  const clinicalFindings = {
    diagnosis: 'Hipertensi esensial',
    vital_signs: 'TD: 160/100 mmHg (tinggi)',
    medication: 'Amlodipine 5mg'
  };

  const result = generateCodingExplanation(
    'I10',
    'diagnosis',
    'approved',
    clinicalFindings,
    'Resume Medis hal. 1'
  );

  console.log('\n=== Test Case: Hypertension (I10) ===');
  console.log('Input: I10 dengan bukti TD tinggi');
  console.log('Result:', {
    codes: result.codes.length,
    summary: result.summary
  });

  return result;
}

// ─── Test Case 3: Multiple Codes ─────────────────────────────────────────────

/**
 * Multiple diagnosis codes dengan bukti parsial
 */
export function testMultipleCodesCase(): CodingExplanationResult {
  const clinicalFindings = {
    diagnosis: 'Asthma + Hypertension',
    findings: 'Sesak, TD tinggi'
  };

  const result = generateCodingExplanation(
    'J45.9;I10',
    'diagnosis',
    'valid',
    clinicalFindings,
    'Resume Medis hal. 1-2'
  );

  console.log('\n=== Test Case: Multiple Codes (J45.9;I10) ===');
  console.log('Input: 2 diagnosis codes');
  console.log('Result:', {
    totalCodes: result.codes.length,
    summary: result.summary,
    codes: result.codes.map(c => c.code)
  });

  return result;
}

// ─── Test Case 4: Procedure Code (93.94 - Nebulization) ──────────────────────

/**
 * Prosedur: 93.94 (Nebulization therapy)
 * Status: Disetujui
 */
export function testProcedureCase(): CodingExplanationResult {
  const clinicalFindings = {
    procedure: 'Nebulisasi bronkodilator',
    notes: 'Dilakukan 4x sehari'
  };

  const result = generateCodingExplanation(
    '93.94',
    'procedure',
    'approved',
    clinicalFindings
  );

  console.log('\n=== Test Case: Procedure (93.94) ===');
  console.log('Input: 93.94 (Nebulization)');
  console.log('Result:', {
    codes: result.codes.length,
    summary: result.summary
  });

  if (result.codes.length > 0) {
    const code = result.codes[0];
    console.log('\nProcedure Description:');
    console.log(`  Code: ${code.code}`);
    console.log(`  Description: ${code.description}`);
    console.log(`  Layman: ${code.layman}`);
  }

  return result;
}

// ─── Test Case 5: Code Not Found ─────────────────────────────────────────────

/**
 * Test dengan kode yang tidak ada di kamus
 */
export function testUnknownCodeCase(): CodingExplanationResult {
  const result = generateCodingExplanation(
    'Z99.9;X00.0', // Kode yang tidak ada di dictionary
    'diagnosis',
    'valid'
  );

  console.log('\n=== Test Case: Unknown Codes ===');
  console.log('Input: Z99.9;X00.0 (codes not in dictionary)');
  console.log('Result:', {
    codes: result.codes.length,
    summary: result.summary,
    isComplete: result.isComplete
  });

  return result;
}

// ─── Run All Tests ──────────────────────────────────────────────────────────

export function runAllTests(): void {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  generateCodingExplanation Test Suite                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    testFirdanCase();
    testHypertensionCase();
    testMultipleCodesCase();
    testProcedureCase();
    testUnknownCodeCase();

    console.log('\n✓ All tests completed');
  } catch (error) {
    console.error('✗ Test error:', error);
  }
}

// ─── Utility: Display Sample Output ──────────────────────────────────────────

/**
 * Contoh UI output untuk Firdan case
 */
export function sampleUIOutput(): string {
  return `
    Field: DIAGLIST (Daftar Diagnosis)
    Value: J45.9
    Status: Valid ✓

    ▸ Penjelasan Kode (1 kode)
      (click untuk expand)

    When expanded:
    ▾ Penjelasan Kode (1 kode)

      • J45.9 (Diagnosis)
      • Asthma, unspecified (WHO ICD-10 2010)
      • Penyakit sesak nafas jangka panjang tanpa penyebab spesifik yang diketahui
      • Temuan: Auskultasi paru menunjukkan obstruksi saluran napas
      • Tercatat di Resume Medis hal. 2
      • Status: Valid
  `;
}

// Test: Export untuk dijalankan di console browser
if (typeof window !== 'undefined') {
  Object.assign(window, { testCodingExplanation: {
    runAllTests,
    testFirdanCase,
    testHypertensionCase,
    testMultipleCodesCase,
    testProcedureCase,
    sampleUIOutput
  } });
}
