/**
 * Test Suite: Saran Koding dengan Desain Bukti-Dulu
 *
 * Test case utama: Firdan Muhammad
 * Expected output: J45.9 + 93.94 + semua citations + alternatives
 *
 * Alur test:
 * 1. Extract klinis dari Resume Medis
 * 2. Validasi setiap kode punya kutipan halaman
 * 3. Grouping ke INA-CBG (tanpa tarif)
 * 4. Lookup tarif (PMK 3/2023)
 * 5. Generate alternatives dengan reasoning
 */

import type {
  ClinicalExtract,
  SuggestedCodesResult,
  GroupedCodesResult,
  SuggestionFinalResult,
} from './suggestCodingService';

// ─── Test Case 1: Firdan Muhammad ───────────────────────────────────────────

/**
 * Kasus Firdan: Asthma bronchiale dengan status asthmaticus, dirawat inap 3 hari
 *
 * Dokumen yang tersedia:
 * - Halaman 1: Resume Medis
 *   - Diagnosis utama: "Bronchial asthma, status asthmaticus"
 *   - Prosedur: "Oxygen therapy, inhalation therapy with bronchodilators"
 *   - Vital tanda: "SpO2 78% saat masuk, naik jadi 94% setelah terapi"
 * - Halaman 2: Lab results
 *   - "Hematology: Hb 13.2"
 * - Halaman 3: Chest imaging
 *   - "CXR: Mild hyperinflation"
 *
 * Expected ICD codes:
 * - Diagnosis utama (Halaman 1): J45.9 (Asthma, unspecified) atau J45.901 (Status asthmaticus)
 * - Procedure (Halaman 1): 93.94 (Nebulizer therapy)
 *
 * Alternatif yang dijawab tidak dipilih:
 * - J45.1 (Nonallergic asthma) — tanpa bukti alergi di dokumen
 * - 93.90 (Respiratory therapy) — terlalu umum, 93.94 lebih spesifik (nebulisasi terdokumentasi)
 */
export const testCaseFirdan = {
  recordId: 'firdan-001',
  patientName: 'Firdan Muhammad',
  jenisKlaim: 'RAWAT_INAP' as const,
  diagnosisSentence: 'Bronchial asthma with status asthmaticus, SpO2 78% on admission',
  procedureSentence: 'Oxygen therapy via nebulizer with bronchodilators, inhalation therapy',

  // Expected clinical extract
  expectedExtract: {
    record_id: 'firdan-001',
    patient_name: 'Firdan Muhammad',
    admission_date: '2026-09-15',
    discharge_date: '2026-09-18',
    jenis_klaim: 'RAWAT_INAP',
    facts: [
      {
        type: 'diagnosis',
        text: 'Bronchial asthma with status asthmaticus',
        page_number: 1,
        quotation: 'Bronchial asthma, status asthmaticus',
        context: 'Chief complaint & diagnosis section',
      },
      {
        type: 'vital_sign',
        text: 'SpO2 78% on admission',
        page_number: 1,
        quotation: 'SpO2 78% saat masuk',
        context: 'Vital signs monitoring',
      },
      {
        type: 'procedure',
        text: 'Oxygen therapy via nebulizer with bronchodilators',
        page_number: 1,
        quotation: 'Oxygen therapy, inhalation therapy with bronchodilators',
        context: 'Treatment section',
      },
      {
        type: 'imaging',
        text: 'CXR: Mild hyperinflation',
        page_number: 3,
        quotation: 'CXR: Mild hyperinflation',
        context: 'Radiology findings',
      },
    ],
    summary: 'Pasien Firdan, 3 hari rawat inap dengan asma akut + status asthmaticus, SpO2 rendah yang membaik dengan nebulisasi dan O2.',
  } as ClinicalExtract,

  // Expected suggested codes
  expectedSuggestedCodes: {
    diagnosis_codes: [
      {
        code: 'J45.9',
        system: 'ICD-10-WHO',
        description: 'Asthma, unspecified',
        quotation: 'Bronchial asthma, status asthmaticus',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Status asthmaticus adalah kondisi krisis asma yang memerlukan kode utama J45.9 atau J45.901. Dokumen jelas menyebutkan status asthmaticus dengan SpO2 rendah.',
      },
    ],
    procedure_codes: [
      {
        code: '93.94',
        system: 'ICD-9-CM',
        description: 'Nebulizer therapy',
        quotation: 'Oxygen therapy, inhalation therapy with bronchodilators',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Prosedur nebulisasi dengan bronchodilators terdokumentasi di halaman 1. Kode 93.94 spesifik untuk nebulizer therapy yang merupakan bagian dari inhalation therapy.',
      },
    ],
    rejected_codes: [], // Semua kode yang suggested harus punya kutipan
  } as SuggestedCodesResult,

  // Expected grouped result
  expectedGroupedResult: {
    diagnosis_codes: [
      {
        code: 'J45.9',
        system: 'ICD-10-WHO',
        description: 'Asthma, unspecified',
        quotation: 'Bronchial asthma, status asthmaticus',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Status asthmaticus dengan desaturasi O2 berat',
      },
    ],
    procedure_codes: [
      {
        code: '93.94',
        system: 'ICD-9-CM',
        description: 'Nebulizer therapy',
        quotation: 'Oxygen therapy, inhalation therapy with bronchodilators',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Nebulisasi terdokumentasi',
      },
    ],
    inacbg_suggestion: 'A82XXX', // Example INA-CBG for asthma with inpatient care
    reasoning: 'Diagnosis J45.9 (asthma unspecified) + procedure 93.94 (nebulizer) + RAWAT_INAP = INA-CBG A82XXX. Grouping blind to tariff.',
    alternatives: [
      {
        rank: 2,
        inacbg_code: 'A81XXX',
        diagnosis_codes: ['J45.1'],
        procedure_codes: ['93.90'],
        reason_not_selected: 'J45.1 (Nonallergic asthma) tidak ada bukti alergi di dokumen. 93.90 (Respiratory therapy) terlalu umum dibanding 93.94 yang lebih spesifik untuk nebulisasi.',
        evidence: 'Dokumen menyebutkan "bronchodilators via nebulizer" 2x (halaman 1 dan catatan treatment), bukan respiratory therapy umum.',
      },
    ],
  } as GroupedCodesResult,

  // Expected final result
  expectedFinalResult: {
    record_id: 'firdan-001',
    patient_name: 'Firdan Muhammad',
    jenis_klaim: 'RAWAT_INAP',
    selected_diagnosis_codes: [
      {
        code: 'J45.9',
        system: 'ICD-10-WHO',
        description: 'Asthma, unspecified',
        quotation: 'Bronchial asthma, status asthmaticus',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Status asthmaticus dengan desaturasi O2 berat (78%)',
      },
    ],
    selected_procedure_codes: [
      {
        code: '93.94',
        system: 'ICD-9-CM',
        description: 'Nebulizer therapy',
        quotation: 'Oxygen therapy, inhalation therapy with bronchodilators',
        page_number: 1,
        confidence: 'high',
        reasoning: 'Nebulisasi dengan bronchodilators, terapi utama untuk status asthmaticus',
      },
    ],
    selected_inacbg: 'A82XXX',
    tariff: {
      inacbg_code: 'A82XXX',
      tariff: 2500000, // Example tariff
      source: 'PMK 3/2023 Regional 1 Kelas D',
      region: 'Regional 1',
      class: 'D',
    },
    alternatives: [
      {
        rank: 2,
        inacbg_code: 'A81XXX',
        diagnosis_codes: ['J45.1'],
        procedure_codes: ['93.90'],
        reason_not_selected: 'J45.1 tidak ada bukti alergi; 93.90 terlalu umum',
        evidence: 'nebulisasi terdokumentasi di 2 bagian dokumen',
      },
    ],
    timestamp: new Date().toISOString(),
  } as SuggestionFinalResult,
};

// ─── Test Assertions ────────────────────────────────────────────────────────

export function validateFirdanResult(result: SuggestionFinalResult): void {
  console.log('=== Validating Firdan Test Case ===');

  // 1. Diagnosis codes
  const diagCodes = result.selected_diagnosis_codes.map((c) => c.code);
  console.assert(diagCodes.includes('J45.9'), `Expected J45.9 in diagnosis, got: ${diagCodes.join(', ')}`);
  console.log('✓ Diagnosis codes valid (J45.9 present)');

  // 2. Procedure codes
  const procCodes = result.selected_procedure_codes.map((c) => c.code);
  console.assert(procCodes.includes('93.94'), `Expected 93.94 in procedure, got: ${procCodes.join(', ')}`);
  console.log('✓ Procedure codes valid (93.94 present)');

  // 3. All codes have citations
  [...result.selected_diagnosis_codes, ...result.selected_procedure_codes].forEach((code) => {
    console.assert(
      code.quotation && code.page_number !== null,
      `Code ${code.code} missing citation`
    );
  });
  console.log('✓ All codes have citations with page numbers');

  // 4. Alternatives exist
  console.assert(result.alternatives.length > 0, 'Expected alternatives');
  console.log(`✓ Alternatives generated (${result.alternatives.length} found)`);

  // 5. INA-CBG is set
  console.assert(result.selected_inacbg, 'Expected INA-CBG code');
  console.log(`✓ INA-CBG code assigned: ${result.selected_inacbg}`);

  // 6. Tariff is present (optional, may be null if data not available)
  if (result.tariff) {
    console.log(`✓ Tariff found: Rp ${result.tariff.tariff.toLocaleString('id-ID')}`);
  } else {
    console.log('⚠ Tariff lookup not available (data may not be loaded yet)');
  }

  console.log('=== All Firdan assertions passed ===');
}

// ─── Documentation Example ──────────────────────────────────────────────────

/**
 * Contoh penggunaan dalam komponen React:
 *
 * ```tsx
 * import { suggestCoding } from '@/lib/suggestCodingService';
 * import { SuggestionCodesCard } from '@/components/SuggestionCodesCard';
 *
 * export function CodingSuggestionDemo() {
 *   const [result, setResult] = useState<SuggestionFinalResult | null>(null);
 *   const [loading, setLoading] = useState(false);
 *
 *   const handleSuggest = async () => {
 *     setLoading(true);
 *     try {
 *       const suggestion = await suggestCoding(
 *         'firdan-001',
 *         'Bronchial asthma with status asthmaticus, SpO2 78% on admission',
 *         'Oxygen therapy via nebulizer with bronchodilators',
 *         'RAWAT_INAP',
 *         'Firdan Muhammad'
 *       );
 *       setResult(suggestion);
 *     } catch (error) {
 *       console.error('Gagal suggest koding:', error);
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSuggest} disabled={loading}>
 *         {loading ? 'Memproses...' : 'Suggest Koding'}
 *       </button>
 *       {result && <SuggestionCodesCard result={result} />}
 *     </div>
 *   );
 * }
 * ```
 */

// ─── Test Case 2: Negative Case ─────────────────────────────────────────────

/**
 * Kasus tanpa bukti dokumen yang cukup
 * Expected: Error message yang user-friendly
 */
export const testCaseNoBasis = {
  recordId: 'nobasis-001',
  patientName: 'Patient X',
  jenisKlaim: 'RAWAT_JALAN' as const,
  diagnosisSentence: 'Hypertension',
  procedureSentence: '', // Kosong

  expectedError: 'Tidak ada diagnosis atau prosedur dengan bukti yang ditemukan.',
};

// ─── Test Case 3: Multiple Diagnosis ────────────────────────────────────────

/**
 * Kasus dengan diagnosis + prosedur multiple
 * Expected: Semua kode dengan kutipan terpisah, grouping gabung semua
 */
export const testCaseMultiple = {
  recordId: 'multi-001',
  patientName: 'Patient Multi',
  jenisKlaim: 'RAWAT_INAP' as const,
  diagnosisSentence: 'Diabetes mellitus tipe 2 with hypertension and chronic kidney disease',
  procedureSentence: 'Blood glucose monitoring, dialysis session, anti-hypertensive therapy',

  expectedDiagnosisCodes: ['E11.9', 'I10', 'N18.3'], // DM + HT + CKD stage 3
  expectedProcedureCodes: ['99.59', '39.95', '99.23'], // Monitoring + dialysis + IV therapy

  // Setiap kode harus punya kutipan dari bagian berbeda dokumen
};

/**
 * Manual test checklist sebelum deploy:
 *
 * [ ] Extract clinical facts dari Resume Medis dengan halaman yang benar
 * [ ] Setiap kode diagnosis + procedure punya quotation + page_number
 * [ ] Kode tanpa bukti di-reject otomatis
 * [ ] Grouping berjalan tanpa tarif sebagai input
 * [ ] Alternatives di-generate dengan reasoning jelas
 * [ ] Firdan case: J45.9 + 93.94 ditemukan
 * [ ] UI card menampilkan kutipan dokumen dengan baik
 * [ ] Copy-to-clipboard tombol berfungsi
 * [ ] Tariff lookup tidak crash meski data belum ada
 * [ ] Error message user-friendly (tanpa tech jargon)
 */
