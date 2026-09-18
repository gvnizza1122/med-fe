/**
 * Saran Koding dengan Desain Bukti-Dulu (Evidence-First Design)
 * 5-step architecture untuk suggestion kode diagnosis + prosedur
 *
 * Alur:
 * 1. Extract & cite — Ambil fakta klinis dari Resume Medis + halaman quotes
 * 2. Suggest codes — LLM suggest ICD-10 + ICD-9, SETIAP kode harus punya kutipan
 * 3. Group codes — Grouping codes untuk INA-CBG (tanpa tarif sebagai input)
 * 4. Tariff lookup — Ambil tarif dari PMK 3/2023 Regional 1 Kelas D (hanya output)
 * 5. Show alternatives — Tampilkan kode tidak dipilih + alasan penolakan
 */

import { api } from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClinicalFact {
  type: 'diagnosis' | 'procedure' | 'vital_sign' | 'lab_result' | 'imaging';
  text: string;
  page_number: number;
  quotation: string;
  context?: string; // Konteks tambahan dari dokumen
}

export interface ClinicalExtract {
  record_id: string;
  patient_name: string;
  admission_date: string;
  discharge_date: string;
  jenis_klaim: 'RAWAT_JALAN' | 'RAWAT_INAP' | 'GAWAT_DARURAT';
  facts: ClinicalFact[];
  summary: string; // Ringkasan kasus 1-2 kalimat
}

export interface CodeWithCitation {
  code: string;
  system: 'ICD-10-WHO' | 'ICD-9-CM';
  description: string;
  quotation: string;
  page_number: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface SuggestedCodesResult {
  diagnosis_codes: CodeWithCitation[];
  procedure_codes: CodeWithCitation[];
  rejected_codes: RejectedCode[]; // Kode yang LLM suggest tapi ditolak (tanpa kutipan)
}

export interface RejectedCode {
  code: string;
  system: 'ICD-10-WHO' | 'ICD-9-CM';
  reason: 'no_quotation' | 'no_page_reference' | 'confidence_too_low' | 'not_clinically_supported';
}

export interface GroupedCodesResult {
  diagnosis_codes: CodeWithCitation[];
  procedure_codes: CodeWithCitation[];
  inacbg_suggestion: string; // Kode INA-CBG yang disarankan
  reasoning: string; // Alasan grouping (diagnosis + prosedur + jenis_klaim = INA-CBG)
  alternatives: AlternativeGroup[];
}

export interface AlternativeGroup {
  rank: number;
  inacbg_code: string;
  diagnosis_codes: string[];
  procedure_codes: string[];
  reason_not_selected: string; // Alasan mengapa alternatif ini tidak dipilih
  evidence: string; // Bukti dari dokumen, e.g. "nebulisasi terdokumentasi di 2 halaman"
}

export interface TariffResult {
  inacbg_code: string;
  tariff: number;
  source: string; // "PMK 3/2023 Regional 1 Kelas D"
  region: string;
  class: string;
}

export interface SuggestionFinalResult {
  record_id: string;
  patient_name: string;
  jenis_klaim: string;
  selected_diagnosis_codes: CodeWithCitation[];
  selected_procedure_codes: CodeWithCitation[];
  selected_inacbg: string;
  tariff: TariffResult | null;
  alternatives: AlternativeGroup[];
  timestamp: string;
}

// ─── Step 1: Extract & Cite ──────────────────────────────────────────────────

/**
 * Ekstraksi fakta klinis dari Resume Medis dengan kutipan halaman
 * Input: diagnosis sentence, procedure sentence, care type
 */
export async function extractClinicalFacts(
  recordId: string,
  diagnosisSentence: string,
  procedureSentence: string,
  jenisKlaim: string
): Promise<ClinicalExtract> {
  try {
    // Call backend API untuk ekstraksi dengan LLM
    const response = await api.extractClinicalFacts(recordId, diagnosisSentence, procedureSentence, jenisKlaim);

    return response as ClinicalExtract;
  } catch (error) {
    console.error('Ekstraksi fakta klinis gagal:', error);
    throw new Error(
      'Tidak dapat mengekstrak fakta klinis dari Resume Medis. ' +
      'Periksa kembali isian diagnosis dan prosedur.'
    );
  }
}

// ─── Step 2: Suggest Codes ──────────────────────────────────────────────────

/**
 * Sugesti kode ICD-10 + ICD-9 dari LLM
 * SETIAP kode WAJIB punya kutipan dokumen
 * Kode tanpa kutipan = TOLAK
 */
export async function suggestCodesWithCitations(
  extract: ClinicalExtract
): Promise<SuggestedCodesResult> {
  try {
    // Call LLM via backend untuk suggest codes dengan bukti
    const response = await api.suggestCodesWithCitations(extract as unknown as Record<string, unknown>);

    // Validasi: semua kode harus punya quotation + page_number
    const result = response as SuggestedCodesResult;
    const rejectedCodes: RejectedCode[] = [];

    // Validasi diagnosis codes
    result.diagnosis_codes = result.diagnosis_codes.filter((code) => {
      if (!code.quotation || code.page_number === null) {
        rejectedCodes.push({
          code: code.code,
          system: code.system,
          reason: 'no_quotation',
        });
        return false;
      }
      return true;
    });

    // Validasi procedure codes
    result.procedure_codes = result.procedure_codes.filter((code) => {
      if (!code.quotation || code.page_number === null) {
        rejectedCodes.push({
          code: code.code,
          system: code.system,
          reason: 'no_quotation',
        });
        return false;
      }
      return true;
    });

    result.rejected_codes = rejectedCodes;

    if (result.diagnosis_codes.length === 0 && result.procedure_codes.length === 0) {
      throw new Error(
        'Tidak ada kode dengan bukti dokumen yang valid. ' +
        'Pastikan Resume Medis berisi diagnosis dan prosedur yang jelas.'
      );
    }

    return result;
  } catch (error) {
    console.error('Sugesti kode gagal:', error);
    throw new Error(
      'Tidak dapat menyarankan kode medis. Periksa kembali dokumen dan ' +
      'coba lagi. Jika terus berulang, hubungi petugas IT.'
    );
  }
}

// ─── Step 3: Group Codes (Blind to Tariff) ──────────────────────────────────

/**
 * Grouping codes untuk INA-CBG
 * TANPA tariff sebagai parameter input
 * Input: diagnosis codes + procedure codes + jenis_klaim
 * Output: INA-CBG code + alternatives
 */
export async function groupCodesToInaCBG(
  diagnosisCodes: CodeWithCitation[],
  procedureCodes: CodeWithCitation[],
  jenisKlaim: 'RAWAT_JALAN' | 'RAWAT_INAP' | 'GAWAT_DARURAT'
): Promise<GroupedCodesResult> {
  try {
    // Grouper logic - blind to tariff
    const response = await api.groupCodesToInaCBG(
      diagnosisCodes.map((c) => c.code),
      procedureCodes.map((c) => c.code),
      jenisKlaim
    );

    const result = response as GroupedCodesResult;
    result.diagnosis_codes = diagnosisCodes;
    result.procedure_codes = procedureCodes;

    return result;
  } catch (error) {
    console.error('Grouping kode gagal:', error);
    throw new Error(
      'Tidak dapat mengelompokkan kode ke INA-CBG. ' +
      'Periksa kembali diagnosis dan prosedur, lalu coba lagi.'
    );
  }
}

// ─── Step 4: Tariff Lookup ──────────────────────────────────────────────────

/**
 * Lookup tarif dari PMK 3/2023 Regional 1 Kelas D
 * Tarif adalah RESULT, bukan INPUT untuk grouping
 */
export async function lookupTariff(
  inacbgCode: string,
  region: string = 'Regional 1',
  kelasRs: string = 'D'
): Promise<TariffResult | null> {
  try {
    const response = await api.lookupTariff(inacbgCode, region, kelasRs);

    return response as TariffResult;
  } catch (error) {
    console.error('Lookup tarif gagal:', error);
    // Tarif lookup gagal tidak fatal - bisa dihapus dulu (data tarif belum ada)
    return null;
  }
}

// ─── Step 5: Show Alternatives ──────────────────────────────────────────────

/**
 * Tampilkan alternative codes + reasoning mengapa tidak dipilih
 * Contoh: "nebulisasi terdokumentasi di 2 dokumen" = sebab penolakan kode lain
 */
export async function generateAlternatives(
  diagnosisCodes: CodeWithCitation[],
  procedureCodes: CodeWithCitation[],
  selectedInaCbg: string,
  extract: ClinicalExtract
): Promise<AlternativeGroup[]> {
  try {
    const response = await api.generateAlternatives(
      diagnosisCodes as unknown as Record<string, unknown>[],
      procedureCodes as unknown as Record<string, unknown>[],
      selectedInaCbg,
      extract as unknown as Record<string, unknown>
    );

    return response as AlternativeGroup[];
  } catch (error) {
    console.error('Generate alternatif gagal:', error);
    // Gagal di step ini tidak fatal - tetap return empty array
    return [];
  }
}

// ─── Main: Orchestrate All 5 Steps ──────────────────────────────────────────

/**
 * Main function - jalankan 5 langkah secara berurutan
 * Test case: Firdan → J45.9 + 93.94 + semua citations + alternatives
 */
export async function suggestCoding(
  recordId: string,
  diagnosisSentence: string,
  procedureSentence: string,
  jenisKlaim: 'RAWAT_JALAN' | 'RAWAT_INAP' | 'GAWAT_DARURAT',
  patientName: string,
  region: string = 'Regional 1',
  kelasRs: string = 'D'
): Promise<SuggestionFinalResult> {
  try {
    // Step 1: Extract & Cite
    console.log('[Coding] Step 1: Extracting clinical facts...');
    const clinicalExtract = await extractClinicalFacts(
      recordId,
      diagnosisSentence,
      procedureSentence,
      jenisKlaim
    );

    // Step 2: Suggest Codes
    console.log('[Coding] Step 2: Suggesting codes with citations...');
    const suggestedCodes = await suggestCodesWithCitations(clinicalExtract);

    // Validasi: ada diagnosis atau procedure
    if (
      suggestedCodes.diagnosis_codes.length === 0 &&
      suggestedCodes.procedure_codes.length === 0
    ) {
      throw new Error('Tidak ada diagnosis atau prosedur dengan bukti yang ditemukan.');
    }

    // Step 3: Group to INA-CBG
    console.log('[Coding] Step 3: Grouping codes to INA-CBG...');
    const groupedResult = await groupCodesToInaCBG(
      suggestedCodes.diagnosis_codes,
      suggestedCodes.procedure_codes,
      jenisKlaim
    );

    // Step 4: Lookup Tariff
    console.log('[Coding] Step 4: Looking up tariff...');
    const tariff = await lookupTariff(
      groupedResult.inacbg_suggestion,
      region,
      kelasRs
    );

    // Step 5: Generate Alternatives
    console.log('[Coding] Step 5: Generating alternatives...');
    const alternatives = await generateAlternatives(
      suggestedCodes.diagnosis_codes,
      suggestedCodes.procedure_codes,
      groupedResult.inacbg_suggestion,
      clinicalExtract
    );

    const result: SuggestionFinalResult = {
      record_id: recordId,
      patient_name: patientName,
      jenis_klaim: jenisKlaim,
      selected_diagnosis_codes: suggestedCodes.diagnosis_codes,
      selected_procedure_codes: suggestedCodes.procedure_codes,
      selected_inacbg: groupedResult.inacbg_suggestion,
      tariff,
      alternatives,
      timestamp: new Date().toISOString(),
    };

    return result;
  } catch (error) {
    console.error('[Coding] Suggestion pipeline error:', error);
    throw error;
  }
}

// ─── Test Case: Firdan ───────────────────────────────────────────────────────

/**
 * Test case untuk Firdan
 * Expected: J45.9 + 93.94 + semua citations + alternatives
 */
export async function testFirdanCase(): Promise<void> {
  const result = await suggestCoding(
    'firdan-001',
    'Asthma bronchiale dengan status asthmaticus', // Diagnosis
    'Nebulization therapy', // Procedure
    'RAWAT_INAP',
    'Firdan Muhammad',
    'Regional 1',
    'D'
  );

  console.log('=== Firdan Test Case Result ===');
  console.log('Patient:', result.patient_name);
  console.log('Diagnosis codes:', result.selected_diagnosis_codes.map((c) => c.code));
  console.log('Procedure codes:', result.selected_procedure_codes.map((c) => c.code));
  console.log('INA-CBG:', result.selected_inacbg);
  console.log('Tariff:', result.tariff?.tariff || 'N/A');
  console.log('Alternatives count:', result.alternatives.length);

  // Assertion
  const diagCodes = result.selected_diagnosis_codes.map((c) => c.code);
  const procCodes = result.selected_procedure_codes.map((c) => c.code);

  if (!diagCodes.includes('J45.9')) {
    console.warn('WARN: Expected J45.9 in diagnosis codes, got:', diagCodes);
  }
  if (!procCodes.includes('93.94')) {
    console.warn('WARN: Expected 93.94 in procedure codes, got:', procCodes);
  }

  // Validate all codes have citations
  [...result.selected_diagnosis_codes, ...result.selected_procedure_codes].forEach((code) => {
    if (!code.quotation || code.page_number === null) {
      throw new Error(`Code ${code.code} missing citation`);
    }
  });

  console.log('✓ All codes have citations');
  console.log('✓ Alternatives generated:', result.alternatives.length > 0);
}
