/**
 * @fileoverview Integration tests: diagnosis + prosedur -> coherence check
 * -> INA-CBG grouping -> tariff lookup (src/lib/claimValidationWorkflow.ts)
 */

import {
  runClaimValidationWorkflow,
  mergePendingReasonsIntoAiReview,
  type ClaimValidationInput,
} from '@/lib/claimValidationWorkflow';

function baseInput(overrides: Partial<ClaimValidationInput> = {}): ClaimValidationInput {
  return {
    recordId: 'REC-001',
    diagnosis_utama: 'Asma bronkial',
    diagnosis_sekunder: '',
    prosedur: '-',
    alasan_masuk: 'Sesak napas berulang',
    vital_signs: { hr: 88, rr: 20, bp: '118/76', temp: 36.7, spo2: 97 },
    clinical_findings: 'Wheezing ringan, tidak ada tanda distres berat.',
    diagnosisCodes: ['J45.9'],
    procedureCodes: ['9394'],
    serviceType: 'RAWAT_JALAN',
    kelasRs: 'D',
    ...overrides,
  };
}

describe('runClaimValidationWorkflow', () => {
  it('should run coherence -> grouping -> tariff for a coherent record and return READY', async () => {
    const result = await runClaimValidationWorkflow(baseInput());

    expect(result.record_status).toBe('READY');
    expect(result.coherence_issues).toEqual([]);
    expect(result.ai_review.pending_reasons).toEqual([]);

    expect(result.inacbg_result).not.toBeNull();
    expect(result.inacbg_result?.inacbg_code).toBe('J-3-13');
    expect(result.inacbg_result?.confidence).toBeGreaterThan(0.9);

    expect(result.tariff_result).not.toBeNull();
    expect(result.tariff_result?.found).toBe(true);
    expect(result.tariff_result?.tariff_amount).toBe(450000);
    expect(result.tariff_result?.class).toBe('Kelas D');
  });

  it('should short-circuit to PENDING and skip grouping/tariff when clinically incoherent', async () => {
    const input = baseInput({
      diagnosis_utama: 'Syok sepsis',
      alasan_masuk: 'Demam tinggi akibat infeksi berat',
      diagnosisCodes: ['A41.9'],
      procedureCodes: [],
      serviceType: 'RAWAT_INAP',
      vital_signs: { hr: 82, rr: 18, bp: '120/80', temp: 36.8, spo2: 98 }, // normal, contradicts "syok sepsis"
      clinical_findings: 'Pasien sepsis dengan infeksi berat.',
    });

    const result = await runClaimValidationWorkflow(input);

    expect(result.record_status).toBe('PENDING');
    expect(result.inacbg_result).toBeNull();
    expect(result.tariff_result).toBeNull();
    expect(result.coherence_issues.length).toBeGreaterThan(0);
    expect(result.ai_review.pending_reasons).toEqual(result.coherence_issues);
  });

  it('should gracefully report an unknown INA-CBG code from tariff lookup without throwing', async () => {
    const input = baseInput({
      diagnosis_utama: 'Kondisi langka tidak terdaftar',
      diagnosisCodes: ['Z99.9'],
      procedureCodes: [],
      alasan_masuk: 'Kondisi langka tidak terdaftar',
      vital_signs: { hr: 80, rr: 18, bp: '120/80', temp: 36.6, spo2: 98 },
      clinical_findings: 'Tidak ada temuan bermakna.',
    });

    const result = await runClaimValidationWorkflow(input);

    // Diagnosis tidak dikenal grouping rules -> fallback NON-CMG, tetap READY
    // (koherensi tidak masalah, cuma grouping/tarifnya tidak ketemu di master).
    expect(result.record_status).toBe('READY');
    expect(result.inacbg_result?.inacbg_code).toBe('NON-CMG');
    expect(result.tariff_result?.found).toBe(false);
    expect(result.tariff_result?.tariff_amount).toBeNull();
  });

  it('should handle missing vital signs and empty clinical findings without throwing', async () => {
    const input = baseInput({
      vital_signs: {},
      clinical_findings: '',
    });

    await expect(runClaimValidationWorkflow(input)).resolves.toBeDefined();
    const result = await runClaimValidationWorkflow(input);
    expect(result.record_status).toBe('READY');
  });
});

describe('mergePendingReasonsIntoAiReview', () => {
  it('should append pending reasons without clobbering existing ai_review keys', () => {
    const existing = { code_evidence: [{ code: 'J45.9' }], pending_reasons: ['issue lama'] };
    const merged = mergePendingReasonsIntoAiReview(existing, ['issue baru']);

    expect(merged.code_evidence).toEqual(existing.code_evidence);
    expect(merged.pending_reasons).toEqual(['issue lama', 'issue baru']);
  });

  it('should initialize pending_reasons when ai_review is undefined', () => {
    const merged = mergePendingReasonsIntoAiReview(undefined, ['issue satu']);
    expect(merged.pending_reasons).toEqual(['issue satu']);
  });
});
